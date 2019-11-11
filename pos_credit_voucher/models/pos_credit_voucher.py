# See LICENSE file for full copyright and licensing details.

import time

from odoo import _, api, fields, models
from odoo.exceptions import UserError
from odoo.tools import float_is_zero


class PosCreditVoucher(models.Model):
    _name = 'pos.credit.voucher'
    _rec_name = 'credit_voucher_no'

    def random_cardno(self):
        return int(time.time())

    credit_voucher_no = fields.Char(
        string="Credit Voucher No",
        default=random_cardno,
        readonly=True)
    credit_voucher_value = fields.Float(string="Credit Voucher Value")
    customer_id = fields.Many2one(
        'res.partner',
        string="Customer")
    issue_date = fields.Date(
        string="Issue Date",
        default=fields.Date.context_today)
    expire_date = fields.Date(string="Expire Date")
    is_active = fields.Boolean('Active', default=True)
    used_line = fields.One2many(
        'pos.credit.voucher.use',
        'credit_voucher_id',
        string="Used Line")

    @api.multi
    def write(self, vals):
        return super(PosCreditVoucher, self).write(vals)


class PosCreditVoucherUse(models.Model):
    _name = 'pos.credit.voucher.use'
    _rec_name = 'order_name'

    credit_voucher_id = fields.Many2one(
        'pos.credit.voucher',
        string="Voucher",
        readonly=True)
    customer_id = fields.Many2one('res.partner', string="Customer")
    order_name = fields.Char(string="Order Name")
    order_date = fields.Date(string="Order Date")
    amount = fields.Float(string="amount")


class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.multi
    @api.depends('used_ids')
    def compute_amount(self):
        total_used_amount = 0
        for ids in self:
            for used_id in ids.used_ids:
                total_used_amount += used_id.amount
            ids.remaining_amount = total_used_amount

    credit_voucher_ids = fields.One2many(
        'pos.credit.voucher',
        'customer_id',
        string="List of voucher")
    used_ids = fields.One2many(
        'pos.credit.voucher.use',
        'customer_id',
        string="List of used credit voucher")
    remaining_amount = fields.Char(
        compute=compute_amount,
        string="Remaining Amount",
        readonly=True)


class AccountJournal(models.Model):
    _inherit = "account.journal"

    is_credit_voucher_journal = fields.Boolean(
        'Use for Credit Voucher', default=False)

    @api.model
    def name_search(self, name, args=None, operator='ilike', limit=100):
        if self._context.get('pos_journal'):
            if self._context.get('journal_ids') and \
               self._context.get('journal_ids')[0] and \
               self._context.get('journal_ids')[0][2]:
                args += [['id', 'in', self._context.get('journal_ids')[0][2]]]
            else:
                return False
        return super(
            AccountJournal,
            self).name_search(
            name,
            args=args,
            operator=operator,
            limit=limit)


class PosConfig(models.Model):
    _inherit = 'pos.config'

    enable_credit_voucher = fields.Boolean('Enable Credit Voucher')
    enable_credit_journal_id = fields.Many2one(
        'account.journal', string="Credit Voucher Journal")
    credit_voucher_product = fields.Many2one(
        'product.product', 'Credit Voucher Product')
    default_credit_exp_date = fields.Integer(
        'Default Voucher Expire Months',
        default="1")


class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.model
    def _process_order(self, pos_order):
        draft_order_id = pos_order.get('old_order_id', False)
        if pos_order.get('is_pos_reservation_install'):
            if draft_order_id:
                return super(PosOrder, self)._process_order(pos_order)
        if not draft_order_id and pos_order.get('refund_invoice', False):
            return super(PosOrder, self)._process_order(pos_order)
        pos_session = self.env['pos.session'].browse(
            pos_order['pos_session_id'])
        if pos_session.state == 'closing_control' or \
                pos_session.state == 'closed':
            pos_order['pos_session_id'] = self._get_valid_session(pos_order).id
        order = self.create(self._order_fields(pos_order))
        prec_acc = order.pricelist_id.currency_id.decimal_places
        journal_ids = set()
        for payments in pos_order['statement_ids']:
            if not float_is_zero(
                    payments[2]['amount'], precision_digits=prec_acc):
                order.add_payment(self._payment_fields(payments[2]))
            journal_ids.add(payments[2]['journal_id'])

        if pos_session.sequence_number <= pos_order['sequence_number']:
            pos_session.write(
                {'sequence_number': pos_order['sequence_number'] + 1})
            pos_session.refresh()

        if not float_is_zero(pos_order['amount_return'], prec_acc):
            cash_journal_id = pos_session.cash_journal_id.id
            if pos_order.get('credit_voucher') and pos_order.get(
                    'credit_journal_id'):
                cash_journal_id = pos_order.get('credit_journal_id')
            if not cash_journal_id:
                # Select for change one of the cash journals used in this
                # payment
                cash_journal = self.env['account.journal'].search([
                    ('type', '=', 'cash'),
                    ('id', 'in', list(journal_ids)),
                ], limit=1)
                if not cash_journal:
                    # If none, select for change one of the cash journals of \
                    #       the POS
                    # This is used for example when a customer pays by \
                    #       credit card
                    # an amount higher than total amount of the order and gets\
                    #       cash back
                    cash_journal = [
                        statement.journal_id
                        for statement in pos_session.statement_ids
                        if statement.journal_id.type == 'cash']
                    if not cash_journal:
                        raise UserError(_("""
                            No cash statement found for this session.
                            Unable to record returned cash."""))
                cash_journal_id = cash_journal[0].id
            order.add_payment({
                'amount': -pos_order['amount_return'],
                'payment_date': fields.Datetime.now(),
                'payment_name': _('return'),
                'journal': cash_journal_id,
            })
        return order

    @api.model
    def create_from_ui(self, orders):
        order_dict = {o['data']['pos_reference']: o for o in orders}
        pos_order = super(PosOrder, self).create_from_ui(orders)
        for tmp_order in self.browse(pos_order):
            order_exists = order_dict.get(tmp_order.pos_reference)
            order = order_exists['data']
            currency = tmp_order.company_id.currency_id
            if order.get('credit_voucher'):
                for create_details in order.get('credit_voucher', False):
                    if create_details:
                        credit_voucher_amount = currency.round(float(
                            create_details.get('credit_voucher_amount', 0)))
                        vals = {
                            'credit_voucher_no': create_details.get(
                                'credit_voucher_no'),
                            'credit_voucher_value': credit_voucher_amount,
                            'customer_id': create_details.get(
                                'credit_voucher_customer'),
                            'issue_date': create_details.get(
                                'credit_voucher_issue_date'),
                            'expire_date': create_details.get(
                                'credit_voucher_expire_date'),
                        }
                        self.env['pos.credit.voucher'].create(vals)
            #  create redeem credit voucher for use
            if order.get('redeem_credit_voucher'):
                for redeem_credit_voucher_details in order.get(
                        'redeem_credit_voucher', False):
                    if redeem_credit_voucher_details:
                        r_c_voucher_detail = float(
                            redeem_credit_voucher_details
                            .get('redeem_credit_voucher_amount', 0))
                        rcredit_voucher_amount = currency.round(
                            r_c_voucher_detail)
                        redeem_credit_voucher_vals = {
                            'order_name': tmp_order.name,
                            'order_date': tmp_order.date_order,
                            'customer_id':
                            redeem_credit_voucher_details.get(
                                'credit_voucher_customer_id') or False,
                            'credit_voucher_id':
                            redeem_credit_voucher_details.get(
                                'redeem_credit_voucher_no'),
                            'amount': rcredit_voucher_amount,
                        }
                        use_credit_voucher = \
                            self.env['pos.credit.voucher.use'].\
                            create(redeem_credit_voucher_vals)
                        if use_credit_voucher:
                            ucredit_voucher_amount = currency.round(
                                use_credit_voucher.credit_voucher_id.
                                credit_voucher_value -
                                use_credit_voucher.amount)
                            use_credit_voucher.credit_voucher_id.write({
                                'credit_voucher_value': ucredit_voucher_amount
                            })
        return pos_order
