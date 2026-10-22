# Prints every tab of an .xlsx as the two grids the Sheets API hands the importer:
# UNFORMATTED_VALUE (cached values) and FORMULA (formula text, else the literal).
import json
import sys

import openpyxl
from openpyxl.worksheet.formula import ArrayFormula

LAST_COLUMN_NUMBER = 78  # BZ, the importer's read range


def cell_value(value):
    if value is None:
        return ""
    if isinstance(value, ArrayFormula):
        return value.text
    return value


def grid(sheet):
    rows = []
    for row in sheet.iter_rows(max_col=min(sheet.max_column, LAST_COLUMN_NUMBER)):
        cells = [cell_value(cell.value) for cell in row]
        while cells and cells[-1] == "":
            cells.pop()
        rows.append(cells)
    while rows and not rows[-1]:
        rows.pop()
    return rows


# A workbook saved without calculated values would import every formula cell as empty. A Sheets
# export legitimately leaves some uncached (a formula over blanks), so only all-uncached is fatal.
def has_cached_formulas(formula_sheet, value_sheet):
    formula_cells = [
        cell.coordinate
        for row in formula_sheet.iter_rows(max_col=min(formula_sheet.max_column, LAST_COLUMN_NUMBER))
        for cell in row
        if cell.data_type == "f"
    ]
    return not formula_cells or any(value_sheet[coordinate].value is not None for coordinate in formula_cells)


path = sys.argv[1]
formulas = openpyxl.load_workbook(path)
values = openpyxl.load_workbook(path, data_only=True)

for sheet in formulas.worksheets:
    if not has_cached_formulas(sheet, values[sheet.title]):
        sys.exit(
            f"„{sheet.title}”: żadna formuła nie ma obliczonej wartości "
            "— otwórz plik w Excelu/Sheets i zapisz ponownie"
        )

tabs = [
    {"title": sheet.title, "values": grid(values[sheet.title]), "formulas": grid(sheet)}
    for sheet in formulas.worksheets
]
json.dump(tabs, sys.stdout, default=str)
