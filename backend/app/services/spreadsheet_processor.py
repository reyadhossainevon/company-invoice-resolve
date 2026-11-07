import io
import logging
from typing import Any, Dict, List, Tuple
import pandas as pd
from app.core.exceptions import CorruptedFileException

logger = logging.getLogger(__name__)


class SpreadsheetProcessor:
    """
    Parses Excel (.xlsx, .xls) and CSV (.csv) spreadsheets.
    Cleans empty rows/columns, converts values for JSON serialization,
    and produces both structured records and downstream text summaries.
    """

    @classmethod
    def _clean_dataframe(cls, df: pd.DataFrame) -> pd.DataFrame:
        """
        Removes all-empty rows/cols and fills NaN with empty strings or clean defaults.
        """
        # Drop rows and columns that are entirely NaN
        df = df.dropna(how="all", axis=0)
        df = df.dropna(how="all", axis=1)

        # Convert timestamps / datetime columns to ISO formatted strings
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].dt.strftime("%Y-%m-%d %H:%M:%S")

        # Replace NaN, NaT, and infinity values for clean JSON serialization
        df = df.fillna("")
        df = df.replace([float("inf"), float("-inf")], "")

        # Normalize column names to strings
        df.columns = [str(c).strip() if pd.notna(c) else f"Column_{i+1}" for i, c in enumerate(df.columns)]
        return df

    @classmethod
    def _build_text_summary(cls, sheet_name: str, df: pd.DataFrame, max_preview_rows: int = 15) -> str:
        """
        Generates a concise markdown / tabular summary for downstream LLM understanding.
        """
        total_rows = len(df)
        cols = list(df.columns)
        summary_lines = [
            f"### Sheet: {sheet_name}",
            f"- Total Rows: {total_rows}",
            f"- Columns ({len(cols)}): {', '.join(cols)}",
            "",
            "Preview:",
        ]

        if total_rows == 0:
            summary_lines.append("*(Empty sheet)*")
        else:
            # Markdown table preview
            preview_df = df.head(max_preview_rows)
            try:
                summary_lines.append(preview_df.to_markdown(index=False) or "")
            except Exception:
                summary_lines.append(preview_df.to_string(index=False))

            if total_rows > max_preview_rows:
                summary_lines.append(f"\n*(... {total_rows - max_preview_rows} more rows not shown)*")

        return "\n".join(summary_lines)

    @classmethod
    def process_csv(
        cls, file_bytes: bytes, filename: str
    ) -> Tuple[Dict[str, Any], str, Dict[str, Any]]:
        """
        Parses a CSV file.
        Returns: (sheets_dict, text_summary, metadata)
        """
        try:
            # Try reading with common encodings and delimiter detection
            df = None
            encodings = ["utf-8", "utf-8-sig", "latin1", "cp1252"]
            last_err = None

            for enc in encodings:
                try:
                    df = pd.read_csv(
                        io.BytesIO(file_bytes),
                        encoding=enc,
                        sep=None,
                        engine="python",
                        on_bad_lines="skip",
                    )
                    break
                except Exception as e:
                    last_err = e
                    continue

            if df is None:
                raise CorruptedFileException(f"Failed to parse CSV '{filename}': {str(last_err)}")

            df = cls._clean_dataframe(df)
            sheet_name = "CSV_Data"
            records = df.to_dict(orient="records")

            sheet_data = {
                sheet_name: {
                    "sheet_name": sheet_name,
                    "columns": list(df.columns),
                    "row_count": len(df),
                    "column_count": len(df.columns),
                    "records": records,
                }
            }

            text_summary = cls._build_text_summary(sheet_name, df)
            metadata = {
                "sheet_names": [sheet_name],
                "total_rows": len(df),
                "total_columns": len(df.columns),
            }

            return sheet_data, text_summary, metadata

        except CorruptedFileException:
            raise
        except Exception as e:
            raise CorruptedFileException(f"Malformed or unreadable CSV '{filename}': {str(e)}")

    @classmethod
    def process_excel(
        cls, file_bytes: bytes, filename: str
    ) -> Tuple[Dict[str, Any], str, Dict[str, Any]]:
        """
        Parses an Excel workbook (.xlsx or .xls) supporting multiple sheets.
        Returns: (sheets_dict, text_summary, metadata)
        """
        try:
            excel_buffer = io.BytesIO(file_bytes)
            # Detect engine: openpyxl for xlsx, xlrd for xls
            ext = filename.lower()
            engine = "xlrd" if ext.endswith(".xls") else "openpyxl"

            try:
                excel_file = pd.ExcelFile(excel_buffer, engine=engine)
            except Exception as e:
                # If engine failed, try default
                excel_buffer.seek(0)
                excel_file = pd.ExcelFile(excel_buffer)

            sheet_names = excel_file.sheet_names
            if not sheet_names:
                raise CorruptedFileException(f"Excel workbook '{filename}' contains no sheets.")

            sheets_dict: Dict[str, Any] = {}
            summary_sections: List[str] = []
            total_rows_all_sheets = 0

            for s_name in sheet_names:
                try:
                    df = pd.read_excel(excel_file, sheet_name=s_name)
                    df = cls._clean_dataframe(df)
                    records = df.to_dict(orient="records")
                    row_cnt = len(df)
                    total_rows_all_sheets += row_cnt

                    sheets_dict[s_name] = {
                        "sheet_name": s_name,
                        "columns": list(df.columns),
                        "row_count": row_cnt,
                        "column_count": len(df.columns),
                        "records": records,
                    }

                    summary_sections.append(cls._build_text_summary(s_name, df))
                except Exception as sheet_err:
                    logger.warning("Error reading sheet '%s' in %s: %s", s_name, filename, sheet_err)
                    sheets_dict[s_name] = {
                        "sheet_name": s_name,
                        "columns": [],
                        "row_count": 0,
                        "column_count": 0,
                        "records": [],
                        "error": str(sheet_err),
                    }
                    summary_sections.append(f"### Sheet: {s_name}\nError: {str(sheet_err)}")

            full_summary = "\n\n".join(summary_sections)
            metadata = {
                "sheet_names": sheet_names,
                "sheet_count": len(sheet_names),
                "total_rows_all_sheets": total_rows_all_sheets,
            }

            return sheets_dict, full_summary, metadata

        except CorruptedFileException:
            raise
        except Exception as e:
            raise CorruptedFileException(f"Corrupted or invalid Excel workbook '{filename}': {str(e)}")
