"""
⚡ VoltNav - One-Click Application Runner
Cleans the Kaggle dataset if needed and launches the web application.
"""

import os
import sys

def main():
    data_file = os.path.join(os.path.dirname(__file__), "data", "cleaned_ev_stations.json")
    if not os.path.exists(data_file):
        print("Cleaning raw Kaggle dataset first...")
        import clean_data
        clean_data.clean_ev_dataset()

    print("Launching VoltNav Web Application on http://localhost:5000 ...")
    import server
    server.run_server()

if __name__ == '__main__':
    main()
