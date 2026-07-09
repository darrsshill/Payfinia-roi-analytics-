# How to run the Payfinia dashboard

This is a **Streamlit** app. Streamlit takes a Python file and turns it into a
web page you can open in your browser. You only need to do this once to learn it.

## What you need
- Python 3.9 or newer installed on your computer.
- The two files in this folder: `app.py` and `requirements.txt`.

## Step 1 — Open a terminal in this folder
- **Mac:** open the Terminal app. Type `cd ` (with a space), then drag this
  folder into the Terminal window, then press Enter. You are now "inside" the folder.
- **Windows:** open the folder in File Explorer, click the address bar, type
  `cmd`, and press Enter.

## Step 2 — Install the tools (one time only)
Copy-paste this line and press Enter:

```
pip install -r requirements.txt
```

This downloads Streamlit, pandas, and Plotly. It may take a minute.

## Step 3 — Run the dashboard
Copy-paste this line and press Enter:

```
streamlit run app.py
```

Your web browser opens automatically at `http://localhost:8501` and shows the
dashboard. If it doesn't open, copy that address into your browser.

## Step 4 — Stop it
Go back to the terminal and press `Ctrl + C`.

---

## Showing it to a client
- The dashboard runs **on your computer**. To demo it, just share your screen
  while it's running — the charts are interactive (hover to see exact numbers).
- To put it online so others can open a link, the easiest free option is
  **Streamlit Community Cloud** (share.streamlit.io): push these files to a free
  GitHub repo and connect it. Ask me and I'll walk you through it.

## If something breaks
- `pip: command not found` → try `pip3` instead of `pip`, and `python3 -m streamlit run app.py`.
- A red error in the browser → copy the message and send it to me; it's
  usually a missing package, fixed by re-running Step 2.

## What's in the dashboard
Six sections that build the argument for a client: where money moves today,
the cost gap between rails, the growth momentum, fraud by rail, international
proof (Brazil Pix, UK Faster Payments), and a final "what to use" recommendation.
All numbers come from the public sources listed in Deliverable 1.
