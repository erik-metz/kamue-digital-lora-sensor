import pytest
from calendar_recurrence import expand_calendar
from icalendar import Calendar


def calendar(
    extra="",
    overrides="",
    start="DTSTART;TZID=Europe/Berlin:20261022T180000",
    end="DTEND;TZID=Europe/Berlin:20261022T190000",
):
    return Calendar.from_ical(f"""BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:course
{start}
{end}
SUMMARY:Kurs
LOCATION:Lampertheim
{extra}END:VEVENT
{overrides}END:VCALENDAR
""")


def test_weekly_dst_exclusion_additional_date_and_shifted_override():
    override = """BEGIN:VEVENT
UID:course
RECURRENCE-ID;TZID=Europe/Berlin:20261029T180000
DTSTART;TZID=Europe/Berlin:20261030T160000
DTEND;TZID=Europe/Berlin:20261030T170000
LOCATION:Biblis
END:VEVENT
"""
    result = expand_calendar(
        calendar(
            "RRULE:FREQ=WEEKLY;COUNT=3\nEXDATE;TZID=Europe/Berlin:20261105T180000\nRDATE;TZID=Europe/Berlin:20261112T180000\n",
            override,
        )
    )
    assert len(result) == 3
    assert result[0][0].decoded("DTSTART").utcoffset().total_seconds() == 7200
    assert result[1][0].decoded("DTSTART").isoformat() == "2026-10-30T16:00:00+01:00"
    assert result[1][0]["LOCATION"] == "Biblis"
    assert result[2][0].decoded("DTSTART").isoformat() == "2026-11-12T18:00:00+01:00"
    assert len({identity for _, identity in result}) == 3


def test_cancelled_override_preserves_original_identity():
    override = """BEGIN:VEVENT
UID:course
RECURRENCE-ID;TZID=Europe/Berlin:20261029T180000
STATUS:CANCELLED
END:VEVENT
"""
    records = expand_calendar(calendar("RRULE:FREQ=WEEKLY;COUNT=2\n", override))
    assert records[1][0]["STATUS"] == "CANCELLED"
    assert records[1][0].decoded("DTSTART").day == 29


def test_all_day_year_crossing_exclusive_end():
    result = expand_calendar(
        calendar(
            "RRULE:FREQ=DAILY;UNTIL=20270102\n",
            start="DTSTART;VALUE=DATE:20261231",
            end="DTEND;VALUE=DATE:20270101",
        )
    )
    assert len(result) == 3
    assert result[-1][0].decoded("DTEND").isoformat() == "2027-01-03"


@pytest.mark.parametrize(
    "rule",
    [
        "RRULE:FREQ=WEEKLY\n",
        "RRULE:FREQ=SECONDLY;COUNT=2\n",
        "RRULE:FREQ=DAILY;COUNT=1001\n",
        "RRULE:FREQ=DAILY;COUNT=2;UNTIL=20261201T000000Z\n",
        "RRULE:FREQ=DAILY;UNTIL=20401201T000000Z\n",
    ],
)
def test_unbounded_or_unsupported_series_fail_closed(rule):
    with pytest.raises(ValueError):
        expand_calendar(calendar(rule))


def test_orphan_override_is_not_silently_lost():
    override = """BEGIN:VEVENT
UID:course
RECURRENCE-ID;TZID=Europe/Berlin:20261129T180000
STATUS:CANCELLED
END:VEVENT
"""
    with pytest.raises(ValueError, match="Orphan"):
        expand_calendar(calendar("RRULE:FREQ=WEEKLY;COUNT=2\n", override))


def test_nonexistent_summer_time_is_never_published():
    with pytest.raises(ValueError, match="nonexistent"):
        expand_calendar(
            calendar(
                "RRULE:FREQ=DAILY;COUNT=3\n",
                start="DTSTART;TZID=Europe/Berlin:20260328T023000",
                end="DTEND;TZID=Europe/Berlin:20260328T033000",
            )
        )


def test_wrong_exclusion_type_aborts_instead_of_silently_ignoring_exception():
    with pytest.raises(ValueError, match="type mismatch"):
        expand_calendar(
            calendar("RRULE:FREQ=WEEKLY;COUNT=2\nEXDATE;VALUE=DATE:20261029\n")
        )


def test_zero_interval_is_rejected():
    with pytest.raises(ValueError, match="interval"):
        expand_calendar(calendar("RRULE:FREQ=WEEKLY;COUNT=2;INTERVAL=0\n"))
