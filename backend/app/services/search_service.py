import logging
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from app.db.models import DocumentRecord, ExtractedInvoiceRecord

logger = logging.getLogger(__name__)


class SearchEngine:
    """
    Hybrid Search Engine supporting:
    1. Exact / Partial Keyword Search & Filter Queries
    2. Local TF-IDF Cosine Similarity Semantic Vector Search
    """

    @classmethod
    def search(
        cls,
        db: Session,
        query: Optional[str] = None,
        mode: str = "hybrid",  # "hybrid" (default), "keyword", or "semantic"
        status_filter: Optional[str] = None,
    ) -> List[Tuple[DocumentRecord, Optional[float]]]:
        """
        Searches documents.
        Supports:
        - "hybrid": Automatically runs both keyword and TF-IDF semantic vector search.
        - "keyword": Substring matching on fields.
        - "semantic": Local TF-IDF cosine similarity vector search.
        """
        # Base query with joined extraction & validation
        base_query = db.query(DocumentRecord)

        # Apply status filter if specified
        if status_filter and status_filter.lower() != "all":
            norm_status = status_filter.lower()
            if norm_status in ["valid", "verified"]:
                base_query = base_query.join(DocumentRecord.validation_result).filter(
                    DocumentRecord.status == "processed",
                    DocumentRecord.validation_result.has(validation_status="valid")
                )
            elif norm_status in ["needs_review", "attention"]:
                base_query = base_query.join(DocumentRecord.validation_result).filter(
                    DocumentRecord.status == "processed",
                    DocumentRecord.validation_result.has(requires_manual_review=True)
                )
            elif norm_status == "failed":
                base_query = base_query.filter(DocumentRecord.status == "failed")

        docs = base_query.order_by(DocumentRecord.created_at.desc()).all()

        if not query or not query.strip():
            return [(d, None) for d in docs]

        clean_q = query.strip()
        q_lower = clean_q.lower()

        # Keyword matching pass
        keyword_matched_ids = set()
        keyword_results = []
        for d in docs:
            inv = d.extracted_invoice
            match = False

            if q_lower in d.filename.lower():
                match = True
            elif inv:
                if inv.invoice_number and q_lower in inv.invoice_number.lower():
                    match = True
                elif inv.supplier_name and q_lower in inv.supplier_name.lower():
                    match = True
                elif inv.customer_name and q_lower in inv.customer_name.lower():
                    match = True
                elif inv.line_items_json and q_lower in inv.line_items_json.lower():
                    match = True
                elif inv.raw_text_summary and q_lower in inv.raw_text_summary.lower():
                    match = True

            if match:
                keyword_matched_ids.add(d.id)
                keyword_results.append((d, 1.0))

        if mode == "keyword":
            return [(d, None) for d, _ in keyword_results]

        # Semantic TF-IDF pass
        corpus: List[str] = []
        doc_map: List[DocumentRecord] = []

        for d in docs:
            inv = d.extracted_invoice
            parts = [d.filename]
            if inv:
                if inv.invoice_number:
                    parts.append(inv.invoice_number)
                if inv.supplier_name:
                    parts.append(inv.supplier_name)
                if inv.customer_name:
                    parts.append(inv.customer_name)
                for li in inv.line_items:
                    desc = li.get("description")
                    if desc:
                        parts.append(desc)
                if inv.raw_text_summary:
                    parts.append(inv.raw_text_summary)

            doc_text = " ".join(parts).strip()
            corpus.append(doc_text if doc_text else d.filename)
            doc_map.append(d)

        semantic_ranked: List[Tuple[DocumentRecord, float]] = []
        if corpus:
            try:
                vectorizer = TfidfVectorizer(
                    stop_words="english",
                    ngram_range=(1, 2),
                    lowercase=True,
                )
                corpus_matrix = vectorizer.fit_transform(corpus)
                query_vector = vectorizer.transform([clean_q])
                similarities = cosine_similarity(query_vector, corpus_matrix)[0]

                for idx, score in enumerate(similarities):
                    text_lower = corpus[idx].lower()
                    final_score = float(score)
                    if q_lower in text_lower:
                        final_score = max(final_score, 0.65) + 0.15

                    if final_score >= 0.05:
                        semantic_ranked.append((doc_map[idx], round(min(final_score, 1.0), 2)))

                semantic_ranked.sort(key=lambda x: x[1], reverse=True)
            except Exception as e:
                logger.warning("Semantic search vectorizer failed: %s", e)

        if mode == "semantic":
            return semantic_ranked

        # HYBRID MODE (Default): Combine keyword + semantic results with deduplication
        combined: List[Tuple[DocumentRecord, Optional[float]]] = []
        seen_ids = set()

        for d, score in keyword_results:
            combined.append((d, score))
            seen_ids.add(d.id)

        for d, score in semantic_ranked:
            if d.id not in seen_ids:
                combined.append((d, score))
                seen_ids.add(d.id)

        return combined
