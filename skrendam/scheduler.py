"""Warm, long-lived worker: run a scan once a day. Process stays up so calls stay warm."""

from apscheduler.schedulers.blocking import BlockingScheduler

from skrendam.cli import run_scan_command


def start():
    scheduler = BlockingScheduler(timezone="Europe/Vilnius")
    scheduler.add_job(run_scan_command, "cron", hour=6, minute=0, id="daily-scan")
    scheduler.start()


if __name__ == "__main__":
    start()
