"""Eski verileri budayarak Supabase free tier'ı korur."""
import datetime as dt
from common import delete_where, run_job


def main():
    today = dt.date.today()
    cutoff_news = (today - dt.timedelta(days=60)).isoformat()
    cutoff_prices = (today - dt.timedelta(days=400)).isoformat()
    cutoff_earnings = (today - dt.timedelta(days=7)).isoformat()
    delete_where("news", f"published_at=lt.{cutoff_news}")
    delete_where("prices_daily", f"date=lt.{cutoff_prices}")
    delete_where("earnings_calendar", f"earnings_date=lt.{cutoff_earnings}")
    return "ok"


if __name__ == "__main__":
    run_job("prune", main)
