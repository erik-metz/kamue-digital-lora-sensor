import pytest
from adapters import classify_category


@pytest.mark.parametrize(
    "title,details,category",
    [
        ("Kerwe", "Traditionelles Fest mit Live-Musik und Spendenlauf", "festival"),
        ("Konzert Vom Flügel eines Engels berührt", "Traditionelle Musik", "concert"),
        ("Florian Schroeder", "Kabarett mit einem traditionellen Programm", "theater"),
        ("Jugendtreff", "Gemeinsam reden und spielen", "civic"),
        ("Bayrisches Frühstück", "", "civic"),
        ("Hofheimer Volkslauf", "", "sports"),
        ("Kerwelauf", "", "sports"),
        ("75 Jahre Feuerwehr - Spendenlauf", "", "sports"),
        ("Radtour", "", "sports"),
        ("Muttertagsmarkt", "", "market"),
        ("Musikkultur Soulnight", "", "concert"),
    ],
)
def test_event_rubrics_do_not_confuse_traditional_prose_with_sport(
    title, details, category
):
    assert classify_category(title, details) == category
