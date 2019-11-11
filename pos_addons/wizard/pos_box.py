# -*- coding: utf-8 -*-
from odoo.addons.account.wizard.pos_box import CashBox

from odoo import api


class CashBoxOut(CashBox):
    _inherit = 'cash.box.out'

    @api.multi
    def _calculate_values_for_statement_line(self, record):
        res = super(CashBoxOut, self)._calculate_values_for_statement_line(
            record=record)
        res.update({'bank_out': True})
        return res
