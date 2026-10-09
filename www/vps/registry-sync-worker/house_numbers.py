"""Supported individual house numbers; ranges and compound addresses stay unsupported."""
import re


def house_number_parts(value):
    match = re.fullmatch(r"([0-9]+)(?:\s*([A-Za-z]))?", value or "")
    return (match[1], (match[2] or "").upper()) if match else None


def house_number_identity(value):
    parts = house_number_parts(value)
    if parts is None:
        raise ValueError("Unsupported individual house number")
    return "".join(parts)


def house_number_sort(value):
    number, suffix = house_number_parts(value)
    return int(number), suffix
