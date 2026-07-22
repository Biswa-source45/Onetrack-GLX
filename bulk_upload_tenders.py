#!/usr/bin/env python3
"""
OneTrack — Bulk Upload Script for Tenders Workspace (Direct Database Ingestion)
Allows importing and updating tenders from Excel (.xlsx, .xls) or CSV files
directly into the PostgreSQL database.
"""

import os
import sys
import logging
import argparse
import getpass
import datetime
import pandas as pd
import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor

# Configure terminal logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("BulkUpload")

def sanitize_log_str(s):
    if not isinstance(s, str):
        return str(s)
    encoding = sys.stdout.encoding or 'utf-8'
    return s.encode(encoding, errors='replace').decode(encoding)


def format_date(val):
    if pd.isna(val) or val is pd.NaT:
        return None
    try:
        dt = pd.to_datetime(val)
        # Check if NaT after conversion
        if pd.isna(dt):
            return None
        return dt.to_pydatetime()
    except Exception as e:
        logger.debug(f"Failed to parse date '{val}': {e}")
        return None

def format_float(val):
    if pd.isna(val):
        return None
    try:
        return float(val)
    except Exception as e:
        logger.debug(f"Failed to parse float '{val}': {e}")
        return None

def format_bool(val):
    if pd.isna(val):
        return False
    val_str = str(val).strip().lower()
    return val_str in ('yes', 'true', '1', 'y')

def main():
    parser = argparse.ArgumentParser(description="OneTrack Direct DB Bulk Tender Ingestion")
    parser.add_argument("-f", "--file", help="Path to Excel (.xlsx/.xls) or CSV file", default="gem_data.xlsx")
    parser.add_argument("--host", help="PostgreSQL host", default="localhost")
    parser.add_argument("--port", help="PostgreSQL port", default="5433")
    parser.add_argument("--user", help="PostgreSQL user", default="postgres")
    parser.add_argument("--password", help="PostgreSQL password", default="postgres")
    parser.add_argument("--dbname", help="PostgreSQL database name", default="onetrack")
    args = parser.parse_args()

    # Check file existence
    file_path = args.file
    if not os.path.exists(file_path):
        logger.error(f"Input file not found at: {file_path}")
        sys.exit(1)

    # 1. Read input file
    logger.info(f"Reading file: {file_path}...")
    try:
        if file_path.lower().endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_path)
        else:
            df = pd.read_csv(file_path)
    except Exception as e:
        logger.error(f"Failed to parse input file: {e}")
        sys.exit(1)

    row_count = len(df)
    logger.info(f"Successfully loaded file. Found {row_count} rows.")

    # 2. Database Connection
    logger.info(f"Connecting to database {args.dbname} on {args.host}:{args.port}...")
    try:
        conn = psycopg2.connect(
            host=args.host,
            port=args.port,
            user=args.user,
            password=args.password,
            database=args.dbname
        )
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=RealDictCursor)
        logger.info("Connected to database successfully.")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        sys.exit(1)

    # 3. Retrieve and choose Bid Owner
    try:
        cur.execute("SELECT id, username, full_name FROM auth.users ORDER BY username")
        users = cur.fetchall()
        if not users:
            logger.error("No users found in auth.users database table. Cannot assign owner.")
            sys.exit(1)
        
        logger.info("Available Users for Bid Ownership:")
        for idx, u in enumerate(users):
            logger.info(f"  {idx + 1}. {u['username']} ({u['full_name']})")
        
        choice_idx = -1
        if not sys.stdin.isatty():
            choice_idx = 0
            logger.info("Non-interactive terminal detected. Defaulting to first user.")
        else:
            while choice_idx < 0 or choice_idx >= len(users):
                choice_str = input(f"Select Bid Owner number [default 1]: ").strip()
                if not choice_str:
                    choice_idx = 0
                    break
                try:
                    choice_idx = int(choice_str) - 1
                except ValueError:
                    choice_idx = -1
        
        owner = users[choice_idx]
        owner_id = owner['id']
        logger.info(f"Selected Bid Owner: {owner['username']} (UUID: {owner_id})")
    except Exception as e:
        logger.error(f"Failed to fetch users from database: {e}")
        conn.close()
        sys.exit(1)

    # 4. Ingest rows
    success_count = 0
    failure_count = 0

    insert_query = """
    INSERT INTO bid.bid_workspaces (
        bid_no, gem_bid_no, title, organization_name, department_name, portal_source,
        creation_mode, workflow_stage, bid_status, bid_owner_id, created_by,
        estimated_value, emd_amount, emd_type, emd_exempted, final_bid_value,
        l1_price, quoted_price, opening_date, closing_date, submission_date, result_date,
        category, bid_type, oem_required, has_tech_eval,
        qualification_status, bid_outcome, outcome_reason, remarks,
        team, scope_type, bg_rate, activity_type, target_month_date,
        excel_bid_status, submission_status, financial_evaluation_status, po_received_status,
        bid_result, created_at, updated_at
    ) VALUES (
        %s, %s, %s, %s, %s, %s,
        %s, %s, %s, %s, %s,
        %s, %s, %s, %s, %s,
        %s, %s, %s, %s, %s, %s,
        %s, %s, %s, %s,
        %s, %s, %s, %s,
        %s, %s, %s, %s, %s,
        %s, %s, %s, %s,
        %s, NOW(), NOW()
    ) RETURNING id;
    """

    for idx, row in df.iterrows():
        row_num = idx + 1
        rfp_id = str(row.get('RFP/BID ID', '')).strip() if not pd.isna(row.get('RFP/BID ID')) else ""
        high_level_scope = str(row.get('High Level Scope', '')).strip() if not pd.isna(row.get('High Level Scope')) else ""

        # Validate title (fallback)
        title = high_level_scope
        if not title:
            if rfp_id:
                title = f"Tender {rfp_id}"
            else:
                title = f"Untitled Bid Row {row_num}"

        # Clean IDs
        bid_no = None
        gem_bid_no = None
        if rfp_id:
            if "gem" in rfp_id.lower():
                gem_bid_no = rfp_id
            else:
                bid_no = rfp_id

        # Basic setup
        portal_source = str(row.get('Platfrom', 'GeM')).strip() if not pd.isna(row.get('Platfrom')) else "GeM"
        
        # Financials
        est_val = format_float(row.get('Estimated Value'))
        bid_val = format_float(row.get('Bid Value'))
        if est_val is None:
            est_val = bid_val

        emd_amount = format_float(row.get('EMD'))
        emd_exempted = format_bool(row.get('EMD Exemption'))
        emd_type = "EXEMPTED" if emd_exempted else ("ONLINE" if emd_amount and emd_amount > 0 else None)

        bg_rate = format_float(row.get('BG'))
        if bg_rate is not None and bg_rate > 1.0:
            bg_rate = bg_rate / 100.0

        # Technical/Evaluation
        tech_eval_val = row.get('Technical Evaluation')
        has_tech_eval = True if not pd.isna(tech_eval_val) and str(tech_eval_val).strip() else False

        # Dates
        opening_date = format_date(row.get('Start Date'))
        closing_date = format_date(row.get('End Date'))
        target_month_date = format_date(row.get('Month'))

        # Lifecycle and Results Resolution
        bid_result_str = str(row.get('Result', '')).strip() if not pd.isna(row.get('Result')) else ""
        result_val_lower = bid_result_str.lower()
        
        workflow_stage = "DISCOVERED"
        bid_status = "ACTIVE"
        bid_outcome = None
        outcome_reason = None
        qualification_status = "PENDING"
        result_date = None

        if result_val_lower:
            if "l1" in result_val_lower:
                workflow_stage = "WON"
                bid_status = "WON"
                bid_outcome = "WON"
                qualification_status = "QUALIFIED"
                outcome_reason = "L1 Win - Imported from master excel."
                result_date = closing_date
            elif result_val_lower not in ('result pending', 'na', 'bid in progress'):
                workflow_stage = "LOST"
                bid_status = "LOST"
                bid_outcome = "LOST"
                if "disqualified" in result_val_lower:
                    qualification_status = "DISQUALIFIED"
                    outcome_reason = "Disqualified during evaluation."
                else:
                    outcome_reason = "Lost - Imported from master excel."
                result_date = closing_date
            else:
                workflow_stage = "AWAITING_RESULT"
                bid_status = "ACTIVE"
        else:
            bid_status_col = str(row.get('Bid Status', '')).strip().lower() if not pd.isna(row.get('Bid Status')) else ""
            if "closed" in bid_status_col:
                workflow_stage = "AWAITING_RESULT"

        # Insertion params
        params = (
            bid_no,
            gem_bid_no,
            title,
            str(row.get('Client/Department', '')).strip() if not pd.isna(row.get('Client/Department')) else None,
            None, # department_name
            portal_source,
            "MANUAL", # creation_mode
            workflow_stage,
            bid_status,
            owner_id,
            owner_id, # created_by
            est_val,
            emd_amount,
            emd_type,
            emd_exempted,
            bid_val, # final_bid_value
            bid_val, # l1_price
            bid_val, # quoted_price
            opening_date,
            closing_date,
            closing_date, # submission_date fallback
            result_date,
            str(row.get('Category', '')).strip() if not pd.isna(row.get('Category')) else None,
            None, # bid_type
            False, # oem_required
            has_tech_eval,
            qualification_status,
            bid_outcome,
            outcome_reason,
            str(row.get('Remark', '')).strip() if not pd.isna(row.get('Remark')) else None,
            str(row.get('Team', '')).strip() if not pd.isna(row.get('Team')) else None,
            str(row.get('Scope Type', '')).strip() if not pd.isna(row.get('Scope Type')) else None,
            bg_rate,
            str(row.get('Activity Type', '')).strip() if not pd.isna(row.get('Activity Type')) else None,
            target_month_date,
            str(row.get('Bid Status', '')).strip() if not pd.isna(row.get('Bid Status')) else None,
            str(row.get('Bid Submission Status', '')).strip() if not pd.isna(row.get('Bid Submission Status')) else None,
            str(row.get('Financial Evaluation', '')).strip() if not pd.isna(row.get('Financial Evaluation')) else None,
            str(row.get('PO Received', '')).strip() if not pd.isna(row.get('PO Received')) else None,
            str(row.get('Result', '')).strip() if not pd.isna(row.get('Result')) else None
        )

        logger.info(f"[{row_num}/{row_count}] Ingesting: '{sanitize_log_str(title)}' (ID: {rfp_id})...")
        try:
            with conn:
                with conn.cursor(cursor_factory=RealDictCursor) as row_cur:
                    row_cur.execute(insert_query, params)
                    bid_id = row_cur.fetchone()['id']

                    # Insert member assignment
                    row_cur.execute("""
                        INSERT INTO bid.bid_workspace_members (bid_id, user_id, role, added_by, added_at)
                        VALUES (%s, %s, 'OWNER', %s, NOW())
                        ON CONFLICT (bid_id, user_id) DO NOTHING;
                    """, (bid_id, owner_id, owner_id))

                    # Insert initial stage transition history
                    row_cur.execute("""
                        INSERT INTO bid.bid_stage_history (bid_id, from_stage, to_stage, transition_reason, transitioned_by, created_at)
                        VALUES (%s, NULL, %s, %s, %s, NOW());
                    """, (bid_id, workflow_stage, f"Initial import. Outcome state: {bid_result_str or 'Active'}", owner_id))

            success_count += 1
        except Exception as e:
            logger.error(f"[{row_num}/{row_count}] Failed to ingest row. Error: {e}")
            failure_count += 1

    cur.close()
    conn.close()

    logger.info("========================================")
    logger.info("DATABASE BULK INGESTION COMPLETED")
    logger.info("========================================")
    logger.info(f"Total processed rows: {row_count}")
    logger.info(f"Successfully imported: {success_count}")
    logger.info(f"Failed imports:        {failure_count}")
    logger.info("========================================")

if __name__ == "__main__":
    main()
