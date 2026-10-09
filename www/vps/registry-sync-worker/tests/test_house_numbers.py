"""Accept individual house letters without guessing compound-address semantics."""
import pytest
from house_numbers import house_number_identity, house_number_parts, house_number_sort


@pytest.mark.parametrize('value', ['8-10', '8/1', '8;9', '8AB', 'A8', '８A', '', None])
def test_unsupported_house_numbers(value):
    assert house_number_parts(value) is None


def test_house_number_order_and_identity():
    assert sorted(['10', '8B', '8', '9 c', '8A'], key=house_number_sort) == ['8', '8A', '8B', '9 c', '10']
    assert house_number_identity('8 a') == '8A'
    assert house_number_identity('08') == '08'
