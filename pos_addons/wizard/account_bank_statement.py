# See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import ValidationError


class AccountBankStmtCashWizard(models.Model):
    _inherit = 'account.bank.statement.cashbox'

    session_end_balance = fields.Float(string='Theoretical Closing Balance ',
                                       readonly=1)
    session_bank_balance = fields.Float(string='Cash to bank')
    session_end_balance_real = fields.Float(string='Real Closing Balance',
                                            compute='get_session_difference')
    session_difference = fields.Float(string='Difference',
                                      compute='get_session_difference')
    cash_register_state = fields.Selection(
        [('start', 'Open Count'),
            ('end', 'Close Count')], default='start')

    remark = fields.Text(string='Remark')
    closing_user = fields.Many2one(
        comodel_name='res.users',
        required=True,
        string='Closing user',
    )
    no_cash_to_bank = fields.Boolean(
        sting='No cash to bank',
        help="Check this is you don't have any cash to bank."
    )

    @api.depends('cashbox_lines_ids', 'session_bank_balance')
    def get_session_difference(self):
        self.session_difference = round(
            sum((v.coin_value * v.number) for v in self.cashbox_lines_ids) -
            self.session_end_balance + self.session_bank_balance, 2)
        self.session_end_balance_real = (self.session_end_balance -
                                         self.session_bank_balance)

    @api.model
    def default_get(self, fields):
        vals = super(AccountBankStmtCashWizard, self).default_get(fields)
        config_id = self.env.context.get('default_pos_id')
        if config_id:
            if self.env.context.get('balance', False) != 'start':
                vals['cash_register_state'] = self.env.context.get('balance',
                                                                   False)
                if self.env.context.get('active_model') == 'pos.session':
                    active_id = self.env.context.get('active_id')
                    if active_id:
                        vals['session_end_balance'] = self.env[
                            'pos.session'].browse(
                            [active_id]).cash_register_balance_end
                if self.env.context.get('active_model') == 'pos.config':
                    active_id = self.env.context.get('active_id')
                    if active_id:
                        pos_config = self.env['pos.config'].browse([active_id])
                        vals['session_end_balance'] = pos_config. \
                            current_session_id.cash_register_balance_end
        return vals

    @api.multi
    def validate(self):
        super(AccountBankStmtCashWizard, self).validate()
        active_model = self.env.context.get('active_model')
        active_id = self.env.context.get('active_id')

        if active_model not in ('pos.session', 'pos.config'):
            return {'type': 'ir.actions.act_window_close'}

        active_record = session = self.env[active_model].browse([active_id])
        # if this is a pos.config then the session is the current session
        # of the pos.config
        if active_model == 'pos.config':
            session = active_record.current_session_id

        # check if the session_bank_balance is different from 0
        # or check that er is no any cash transfer to bank
        if self.session_bank_balance == 0 and not self.no_cash_to_bank \
                and self.cash_register_state == 'end':
            raise ValidationError(
                _('You should either set a bank balance different '
                  'from 0 or check No cash to bank.'))

        if self.remark:
            session.write({'remark': self.remark})

        if self.session_bank_balance > 0:
            bank_statements = \
                session.cash_register_id and [session.cash_register_id] or []
            if bank_statements:
                statement_line = self.env[
                    'account.bank.statement.line'].search(
                    [('to_bank', '=', True),
                        ('pos_session_id', '=', session.id)])
                if len(statement_line) == 0:
                    jnl = bank_statements[0].journal_id
                    ta = jnl.company_id.transfer_account_id.id
                    psn = session.name
                    values = {
                        'date': bank_statements[0].date,
                        'statement_id': bank_statements[0].id,
                        'journal_id': bank_statements[0].journal_id.id,
                        'amount': -abs(self.session_bank_balance),
                        'account_id': ta,
                        'ref': psn,
                        'name': bank_statements[0].name,
                        'to_bank': True,
                        'bank_out': True,
                        'cash_in_out': 'out',
                        'pos_session_id': session.id,
                    }
                    bank_statements[0].write(
                        {'line_ids': [(0, False, values)]})
                else:
                    statement_line.write({
                        'amount': -abs(self.session_bank_balance),
                    })

        return {'type': 'ir.actions.act_window_close'}
