# See LICENSE file for full copyright and licensing details.

import datetime
import logging

from odoo import _, api, fields, models, tools
from odoo.exceptions import UserError
from odoo.tools import float_is_zero
from odoo.tools.safe_eval import safe_eval

import psycopg2


_logger = logging.getLogger(__name__)


class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.model
    def _process_credit_voucher_amount(self, order, order_id=False):
        temp = order.copy()
        temp.update({'lines': order.get('voucher_product_orderLines')})
        temp.update({'name': False})
        if order_id:
            temp.update({'reservation_order_pay_ref_id': order_id.id})
        if temp.get('credit_voucher') and temp.get(
                'credit_journal_id'):
            paid_reservation_order = self._process_order2(temp)
        else:
            paid_reservation_order = super(PosOrder, self)._process_order(temp)
        paid_reservation_order._onchange_amount_all()
        try:
            paid_reservation_order.action_pos_order_paid()
        except psycopg2.OperationalError:
            raise
        except Exception as e:
            _logger.error(
                'Could not fully process the POS Order: %s', tools.ustr(e))

    @api.model
    def _process_order2(self, pos_order):
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
    def _process_order(self, order):
        draft_order_id = order.get('old_order_id')
        pos_credit_voucher = order.get('is_pos_credit_voucher_install')
        if not draft_order_id and order.get('refund_invoice', False):
            temp = order.copy()
            if pos_credit_voucher:
                order.update({'amount_return': 0})
            if order.get('credit_voucher') and order.get(
                    'credit_journal_id'):
                order_id = self._process_order2(order)
            else:
                order_id = super(PosOrder, self)._process_order(order)
            temp.update({'statement_ids': []})
            prec_acc = self.env['decimal.precision'].precision_get('Account')
            if not float_is_zero(temp['amount_return'], prec_acc) and \
                    pos_credit_voucher:
                self._process_credit_voucher_amount(temp, order_id)
        else:
            order_id = super(PosOrder, self)._process_order(order)
        return order_id

    @api.model
    def create_from_ui(self, orders):

        order_ids = super(PosOrder, self).create_from_ui(orders)
        order = {}
        for tmp_order in orders:
            if tmp_order.get('data'):
                order = tmp_order['data']
            else:
                order = tmp_order
            if order_ids:
                if order.get('return_order'):
                    # Return Invoice
                    old_order = self.browse(order.get('return_order'))
                    refund_invoice = order['refund_invoice']
                    if refund_invoice:
                        invoice_refund_obj = self.env['account.invoice.refund']
                        self.account_invoice_refund_0 = \
                            invoice_refund_obj.create(dict(
                                description='Refund Invoice',
                                date=datetime.date.today(),
                                filter_refund='refund'
                            ))
                        self.account_invoice_refund_0.with_context(
                            active_ids=old_order.invoice_id.ids,
                            active_id=old_order.invoice_id.ids[0],
                            order_ids=order_ids,
                            order_credit=order.get('credit_voucher'),
                            is_pos_invoice=True,
                        ).invoice_refund()
        return order_ids


class AccountInvoiceRefund(models.TransientModel):

    _inherit = "account.invoice.refund"

    @api.multi
    def compute_refund(self, mode='refund'):
        context = dict(self._context or {})
        if mode in ('refund') and context.get('is_pos_invoice', False):
            inv_obj = self.env['account.invoice']
            inv_line_obj = self.env['account.invoice.line']
            ir_property_obj = self.env['ir.property']
            xml_id = False

            for form in self:
                created_inv = []
                date = False
                description = False
                for inv in inv_obj.browse(context.get('active_ids')):
                    if inv.state in ['draft', 'cancel']:
                        raise UserError(_('Cannot create credit note for the\
                            draft/cancelled invoice.'))
                    if inv.reconciled and mode in ('cancel', 'modify'):
                        raise UserError(_('Cannot create a credit note for the\
                            invoice which is already reconciled, invoice\
                            should be unreconciled first, then only you can \
                            add credit note for this invoice.'))

                    date = form.date or False
                    description = form.description or inv.name
                    refund = inv.refund(form.date_invoice,
                                        date, description, inv.journal_id.id)

                    created_inv.append(refund.id)
                    if mode in ('refund') and context.get(
                            'is_pos_invoice', False):
                        for order in self.env['pos.order'].browse(
                                context.get('order_ids')):
                            order.write({
                                'invoice_id': refund.id,
                                'state': 'invoiced',
                                'account_move': refund.move_id.id
                            })
                            if refund.invoice_line_ids:
                                refund.invoice_line_ids.unlink()
                                refund.tax_line_ids.unlink()
                            for line in order.lines:
                                account_id = False
                                if line.product_id.id:
                                    account_id = \
                                        line.product_id.\
                                        property_account_income_id.id or \
                                        line.product_id.categ_id.\
                                        property_account_income_categ_id.id
                                if not account_id:
                                    inc_acc = ir_property_obj.get(
                                        'property_account_income_categ_id',
                                        'product.category')
                                    account_id = \
                                        order.fiscal_position_id.map_account(
                                            inc_acc).id if inc_acc else False
                                if not account_id:
                                    raise UserError(
                                        _('There is no income account defined \
                                            for this product: "%s". \
                                            You may have \
                                            to install a chart of account from\
                                             Accounting app, settings menu.') %
                                        (line.product_id.name,))
                                taxes = line.product_id.taxes_id.filtered(
                                    lambda r: not order.company_id or
                                    r.company_id == order.company_id)
                                if order.fiscal_position_id and taxes:
                                    tax_ids = order.fiscal_position_id.map_tax(
                                        taxes).ids
                                else:
                                    tax_ids = taxes.ids
                                inv_line_obj.create({
                                    'product_id': line.product_id.id,
                                    'name': line.product_id.name,
                                    'account_id': account_id,
                                    'origin': order.name,
                                    'quantity': line.qty * -1,
                                    'uom_id': line.product_id.uom_id.id,
                                    'discount': line.discount,
                                    'price_unit': line.price_unit,
                                    'invoice_line_tax_ids': [(6, 0, tax_ids)],
                                    'invoice_id': refund.id
                                })
                            taxes_grouped = refund.get_taxes_values()
                            tax_lines = refund.tax_line_ids.filtered('manual')
                            for tax in taxes_grouped.values():
                                tax_lines += tax_lines.new(tax)
                            refund.tax_line_ids = tax_lines
                        refund.action_invoice_open()
                    xml_id = inv.type == \
                        'out_invoice' and 'action_invoice_out_refund' or \
                        inv.type == \
                        'out_refund' and 'action_invoice_tree1' or \
                        inv.type == \
                        'in_invoice' and 'action_invoice_in_refund' or \
                        inv.type == 'in_refund' and 'action_invoice_tree2'
                    # Put the reason in the chatter
                    subject = _("Credit Note")
                    body = description
                    refund.message_post(body=body, subject=subject)
            if xml_id:
                result = self.env.ref('account.%s' % (xml_id)).read()[0]
                invoice_domain = safe_eval(result['domain'])
                invoice_domain.append(('id', 'in', created_inv))
                result['domain'] = invoice_domain
                return result
            return True
        else:
            return super(AccountInvoiceRefund, self).compute_refund(mode)
