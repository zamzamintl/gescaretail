# See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import UserError
from odoo.addons.point_of_sale.wizard.pos_box import PosBox


class PosConfig(models.Model):
    _inherit = 'pos.config'

    enable_cash_in_out = fields.Boolean("Enable Cash Put In/Out",
                                        default=False)


class PosSession(models.Model):
    _inherit = 'pos.session'

    cash_in_line_ids = fields.One2many(
        'account.bank.statement.line',
        'pos_session_id',
        string='Cash IN',
        domain=[('cash_in_out', '=', 'in')])
    cash_out_line_ids = fields.One2many(
        'account.bank.statement.line',
        'pos_session_id',
        string='Cash OUT',
        domain=[('cash_in_out', '=', 'out')])
    cash_control = fields.Boolean(
        related='config_id.cash_control',
    )

    @api.model
    def take_money_out(self, name, amount, session_id):
        try:
            cash_out_obj = self.env['cash.box.out']
            active_model = 'pos.session'
            active_ids = [session_id]
            if active_model == 'pos.session':
                records = self.env[active_model].browse(active_ids)
                bank_statements = [
                    record.cash_register_id for record in records
                    if record.cash_register_id]
                if not bank_statements:
                    raise UserError(
                        _('There is no cash register for this PoS Session'))
                res = cash_out_obj.create({'name': name, 'amount': amount})
                return res._run(bank_statements)
            else:
                return {}
        except BaseException:
            return {'error': 'There is no cash register for this PoS Session '}

    @api.model
    def put_money_in(self, name, amount, session_id):
        try:
            cash_out_obj = self.env['cash.box.in']
            active_model = 'pos.session'
            active_ids = [session_id]
            if active_model == 'pos.session':
                records = self.env[active_model].browse(active_ids)
                bank_statements = [
                    record.cash_register_id for record in records
                    if record.cash_register_id]
                if not bank_statements:
                    raise UserError(
                        _('There is no cash register for this PoS Session'))
                res = cash_out_obj.create({'name': name, 'amount': amount})
                return res._run(bank_statements)
            else:
                return {}
        except Exception:
            return {'error': 'There is no cash register for this PoS Session '}


class AccountBankStatmentLine(models.Model):
    _inherit = 'account.bank.statement.line'

    pos_session_id = fields.Many2one('pos.session', string="Session")
    cash_in_out = fields.Selection(
        [('in', 'IN'), ('out', 'OUT')], string="IN/out"
    )


class PosBoxIn(PosBox):
    _inherit = 'cash.box.in'

    @api.multi
    def _calculate_values_for_statement_line(self, record):
        values = super(PosBoxIn, self)._calculate_values_for_statement_line(
            record)
        if record and record.pos_session_id:
            values.update({
                'pos_session_id': record.pos_session_id.id,
                'cash_in_out': 'in'})
        if not values.get('ref'):
            values['ref'] = record.pos_session_id.name
        return values


class PosBoxOut(PosBox):
    _inherit = 'cash.box.out'

    @api.multi
    def _calculate_values_for_statement_line(self, record):
        values = super(PosBoxOut, self)._calculate_values_for_statement_line(
            record)
        if record and record.pos_session_id:
            values.update({
                'pos_session_id': record.pos_session_id.id,
                'cash_in_out': 'out'})
        if not values.get('ref'):
            values['ref'] = record.pos_session_id.name
        return values
