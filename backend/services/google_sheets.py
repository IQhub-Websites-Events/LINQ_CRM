import logging
import os
from django.conf import settings
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger('book_event')

class GoogleSheetsService:
    def __init__(self):
        if not os.path.exists(settings.GOOGLE_SHEETS_CREDENTIALS):
            raise FileNotFoundError(f"Credentials not found at {settings.GOOGLE_SHEETS_CREDENTIALS}")

        self.creds = Credentials.from_service_account_file(
            settings.GOOGLE_SHEETS_CREDENTIALS,
            scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )

        raw_id = settings.GOOGLE_SHEET_ID
        if "/" in raw_id:
            parts = [p for p in raw_id.split("/") if p]
            if "d" in parts:
                idx = parts.index("d")
                self.spreadsheet_id = parts[idx+1]
            else:
                self.spreadsheet_id = parts[0]
        else:
            self.spreadsheet_id = raw_id

        self.service = build("sheets", "v4", credentials=self.creds)

    def get_sheet_data(self, sheet_name):
        """Fetch all data from a sheet."""
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"{sheet_name}!A:Z"
            ).execute()
            return result.get('values', [])
        except Exception as e:
            logger.error(f"Error fetching sheet data for {sheet_name}: {e}")
            return []

    def clear_sheet(self, sheet_name):
        """Wipe all data from a sheet."""
        try:
            self.service.spreadsheets().values().clear(
                spreadsheetId=self.spreadsheet_id,
                range=f"{sheet_name}!A:Z"
            ).execute()
        except Exception as e:
            logger.error(f"Error clearing sheet {sheet_name}: {e}")

    def replace_data(self, sheet_name, headers, rows):
        """Wipe and refill the entire sheet."""
        self.clear_sheet(sheet_name)
        body = {'values': [headers] + rows}
        self.service.spreadsheets().values().update(
            spreadsheetId=self.spreadsheet_id,
            range=f"{sheet_name}!A1",
            valueInputOption="RAW",
            body=body
        ).execute()
        return len(rows)

    def sync_data(self, sheet_name, headers, rows, id_index=0):
        """
        Update strategy:
        1. Ensure headers exist.
        2. Map existing rows by ID.
        3. Update existing or append new.
        """
        existing_data = self.get_sheet_data(sheet_name)
        
        if not existing_data:
            # Sheet is empty or doesn't exist, start with headers + all rows
            body = {'values': [headers] + rows}
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"{sheet_name}!A1",
                valueInputOption="RAW",
                body=body
            ).execute()
            return len(rows)

        # Map existing rows by ID (skipping header)
        existing_ids = {}
        for idx, row in enumerate(existing_data[1:], start=2): # 1-indexed, skipping header
            if len(row) > id_index:
                row_id = str(row[id_index])
                existing_ids[row_id] = idx

        updates = []
        new_rows = []

        for row in rows:
            row_id = str(row[id_index])
            if row_id in existing_ids:
                # Update existing row
                row_num = existing_ids[row_id]
                updates.append({
                    'range': f"{sheet_name}!A{row_num}",
                    'values': [row]
                })
            else:
                new_rows.append(row)

        # Execute batch updates
        if updates:
            body = {
                'valueInputOption': 'RAW',
                'data': updates
            }
            self.service.spreadsheets().values().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()

        # Append new rows
        if new_rows:
            body = {'values': new_rows}
            self.service.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=f"{sheet_name}!A1",
                valueInputOption="RAW",
                insertDataOption="INSERT_ROWS",
                body=body
            ).execute()

        return len(rows)

# Singleton instance
google_sheets = None
try:
    google_sheets = GoogleSheetsService()
except Exception as e:
    logger.error(f"Google Sheets Service initialization failed: {e}")
