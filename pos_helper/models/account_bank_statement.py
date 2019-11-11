# -*- coding: utf-8 -*-
from odoo import models, api


class AccountBankStmtCashWizard(models.Model):
    _inherit = 'account.bank.statement.cashbox'

    @api.model
    def default_get(self, fields):
        vals = super(AccountBankStmtCashWizard, self).default_get(fields)
        config_id = self.env.context.get('default_pos_id')
        if config_id:
            if self.env.context.get('balance', False) == 'start':
                last_session_id = self.env['pos.session'].search([
                    ('config_id', '=', config_id),
                    ('state', '=', 'closed')], order="stop_at desc", limit=1)
                if last_session_id:
                    lines = self.env['account.bank.statement'].search(
                        [('pos_session_id', '=', last_session_id.id),
                         ('journal_type', '=',
                          'cash')]).cashbox_end_id.cashbox_lines_ids
                    vals['cashbox_lines_ids'] = [[0, 0, {
                        'coin_value': line.coin_value,
                        'number': line.number, 'subtotal': line.subtotal}]
                        for line in lines]
        return vals
