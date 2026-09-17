import sqlite3
import os
import json
import math

def migrate_db(db_path):
    if not os.path.exists(db_path):
        print(f"Skipping {db_path} (not found)")
        return
    print(f"Migrating {db_path}...")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(zones)")
    existing_cols = [c[1] for c in cur.fetchall()]
    
    columns_to_add = [
        ("zone_type", "VARCHAR(30) DEFAULT 'monitored_area'"),
        ("ward_number", "INT"),
        ("full_address", "TEXT"),
        ("lat", "REAL"),
        ("lng", "REAL"),
        ("is_official_ccmc", "BOOLEAN DEFAULT 0")
    ]
    
    for col_name, col_type in columns_to_add:
        if col_name not in existing_cols:
            try:
                cur.execute(f"ALTER TABLE zones ADD COLUMN {col_name} {col_type};")
                print(f"  Added column {col_name} to {db_path}")
            except Exception as e:
                print(f"  Error adding column {col_name}: {e}")
        else:
            print(f"  Column {col_name} already exists in {db_path}")
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    for p in ["dumpsense.db", "backend/dumpsense.db"]:
        migrate_db(p)
