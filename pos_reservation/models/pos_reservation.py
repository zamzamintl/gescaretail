# See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools, _
from pytz import timezone
from datetime import datetime, timedelta
from odoo.tools import float_is_zero
from odoo.exceptions import UserError
import logging
import psycopg2
_logger = logging.getLogger(__name__)


class ReturnPicking(models.TransientModel):
    _inherit = 'stock.return.picking'

    def _prepare_move_default_values(self, return_line, new_picking):
        res = super(ReturnPicking, self)._prepare_move_default_values(
            return_line=return_line,
            new_picking=new_picking)
        if res:
            res.update({'quantity_done': return_line.quantity})
        return res


class PosConfig(models.Model):
    _inherit = 'pos.config'

    enable_order_reservation = fields.Boolean('Enable Order Reservation')
    reserve_stock_location_id = fields.Many2one(
        'stock.location', 'Reserve Stock Location')
    cancellation_charges_type = fields.Selection(
        [
            ('fixed', 'Fixed'),
            ('percentage', 'Percentage')
        ],
        'Cancellation Charges Type')
    cancellation_charges = fields.Float('Cancellation Charges')
    cancellation_charges_product_id = fields.Many2one(
        'product.product', 'Cancellation Charges Product')
    prod_for_payment = fields.Many2one('product.product',
                                       string='Paid Amount Product',
                                       help="This is a dummy product used \
                                       when a customer pays partially.\
                                       This is a workaround to the fact \
                                       that Odoo needs to have at least \
                                       one product on the order to validate \
                                       the transaction.")
    refund_amount_product_id = fields.Many2one(
        'product.product', 'Refund Amount Product')


class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.model
    def reserved_to_stock_picking(self, order_id):
        picking_out = order_id.picking_id
        if picking_out:
            # Create return picking for all goods
            default_data = self.env['stock.return.picking']\
                .with_context(
                    active_ids=picking_out.ids,
                    active_id=picking_out.ids[0])\
                .default_get([
                    'move_dest_exists',
                    'original_location_id',
                    'product_return_moves',
                    'parent_location_id',
                    'location_id',
                ])
            try:
                if order_id.internal_reservation:
                    default_data.update({
                        'location_id': order_id.config_id.stock_location_id.id}
                    )
            except Exception:
                pass
            return_wiz = self.env['stock.return.picking']\
                .with_context(
                    active_ids=picking_out.ids,
                    active_id=picking_out.ids[0])\
                .create(default_data)
            res = return_wiz.create_returns()
            return_pick = self.env['stock.picking'].browse(res['res_id'])
            wiz_data = return_pick.button_validate()
            if wiz_data and wiz_data.get('res_model', False) and \
                    wiz_data.get('res_id', False):
                self.env[wiz_data['res_model']].browse(
                    wiz_data['res_id']).process()

    @api.multi
    def action_pos_order_paid(self):
        if not self.test_paid():
            if self.cancel_order:
                self.reserved_to_stock_picking(self)
                self.do_internal_transfer()
            raise UserError(_("Order is not paid."))
        self.write({'state': 'paid'})
        if self.cancel_order or self.delivery_date:
            self.reserved_to_stock_picking(self)
        picking = self.create_picking()
        if self.picking_id:
            self.picking_id.pos_order_id = self.id
        return picking

    @api.onchange('statement_ids', 'lines')
    def _onchange_amount_all(self):
        for order in self:
            currency = order.pricelist_id.currency_id
            order.amount_paid = sum(
                payment.amount for payment in order.statement_ids)
            order.amount_return = sum(
                payment.amount < 0 and payment.amount or 0
                for payment in order.statement_ids)
            order.amount_tax = currency.round(sum(self._amount_line_tax(
                line, order.fiscal_position_id) for line in order.lines))
            amount_untaxed = currency.round(
                sum(line.price_subtotal for line in order.lines))
            order.amount_total = order.amount_tax + amount_untaxed
            amount_tax_without_pay_product = currency.round(
                sum(
                    self._amount_line_tax(line, order.fiscal_position_id)
                    for line in order.lines if not line.advance_pay))
            amount_untaxed_without_pay_product = currency.round(
                sum(line.price_subtotal for line in order.lines
                    if not line.advance_pay))

            amount_tax_with_pay_product = currency.round(
                sum(
                    self._amount_line_tax(line, order.fiscal_position_id)
                    for line in order.lines if line.advance_pay))
            amount_untaxed_with_pay_product = currency.round(
                sum(abs(line.price_subtotal) for line in order.lines
                    if line.advance_pay))
            order.amount_due = order.amount_total - order.amount_paid
            order.total_amount = amount_tax_without_pay_product + \
                amount_untaxed_without_pay_product
            order.total_advance_pay = amount_tax_with_pay_product + \
                amount_untaxed_with_pay_product

    @api.multi
    @api.depends('picking_id')
    def _compute_picking_status(self):
        for order in self:
            if order.picking_id:
                order.pos_picking_status = order.picking_id.state

    reserved = fields.Boolean("Reserved", readonly=True)
    delivery_date = fields.Char("Delivery Date")
    cancel_order = fields.Boolean('Cancel Order')
    fresh_order = fields.Boolean("Fresh Order")
    amount_due = fields.Float(string='Amount Due', digits=0)
    total_amount = fields.Float(string='Total Amount', digits=0)
    total_advance_pay = fields.Float(string='Total Advance Pay', digits=0)
    picking_ids = fields.One2many(
        "stock.picking",
        'pos_order_id',
        string="Multiple Picking")
    reservation_order_pay_ref_id = fields.Many2one(
        "pos.order",
        string="Reservation Reference")
    reservation_order_pay_history_ids = fields.One2many(
        "pos.order",
        'reservation_order_pay_ref_id',
        string="Reservation Payment History")
    pos_picking_status = fields.Char(
        string='Pos Picking Status', compute='_compute_picking_status')

    @api.one
    def update_delivery_date(self, delivery_date):
        res = self.write({'delivery_date': datetime.strptime(
            delivery_date, '%d/%m/%Y').strftime('%d/%m/%Y')})
        if res:
            return self.read()[0]
        return False

    def _order_fields(self, ui_order):
        res = super(PosOrder, self)._order_fields(ui_order)
        res.update({
            'delivery_date': ui_order.get('delivery_date') or False,
            'reserved': ui_order.get('reserved') or False,
            'cancel_order': ui_order.get('cancel_order') or False,
            'fresh_order': ui_order.get('fresh_order') or False,
            'reservation_order_pay_ref_id':
            ui_order.get('reservation_order_pay_ref_id') or False,
        })
        return res

    @api.multi
    def do_internal_transfer(self):
        for order in self:
            if order.config_id.reserve_stock_location_id and \
               order.config_id.stock_location_id:
                # Move Lines
                temp_move_lines = []
                for line in order.lines:
                    if line.product_id.default_code:
                        name = [line.product_id.default_code]
                    else:
                        name = line.product_id.name
                    if line.product_id.type != "service":
                        move_vals = (0, 0, {
                            'product_id': line.product_id.id,
                            'name': name,
                            'product_uom_qty': line.qty,
                            'quantity_done': line.qty,
                            'location_id':
                            order.config_id.stock_location_id.id,
                            'location_dest_id':
                            order.config_id.reserve_stock_location_id.id,
                            'product_uom': line.product_id.uom_id.id,
                        })
                        temp_move_lines.append(move_vals)
                warehouse_obj = self.env['stock.warehouse'].search(
                    [
                        ('lot_stock_id', '=',
                            order.config_id.stock_location_id.id)
                    ],
                    limit=1)
                if warehouse_obj:
                    picking_type_obj = self.env['stock.picking.type'].search([
                        ('warehouse_id', '=', warehouse_obj.id),
                        ('code', '=', 'internal')], limit=1)
                    if picking_type_obj and temp_move_lines:
                        picking_vals = {
                            'picking_type_id': picking_type_obj.id,
                            'location_id':
                            order.config_id.stock_location_id.id,
                            'location_dest_id':
                            order.config_id.reserve_stock_location_id.id,
                            'state': 'draft',
                            'move_lines': temp_move_lines,
                            'origin': order.name,
                            'pos_order_id': order.id
                        }
                        picking = self.env['stock.picking'].create(
                            picking_vals)
                        if picking:
                            picking.action_confirm()
                            wiz_data = picking.button_validate()
                            if wiz_data and wiz_data.get('res_model', False) \
                                    and wiz_data.get('res_id', False):
                                self.env[wiz_data['res_model']].browse(
                                    wiz_data['res_id']).process()
                            order.picking_id = picking.id

    @api.model
    def _process_order_payment(self, pos_order, order_id):
        prec_acc = self.env['decimal.precision'].precision_get('Account')
        pos_session = self.env['pos.session'].browse(
            pos_order['pos_session_id'])
        journal_ids = set()
        for payments in pos_order['statement_ids']:
            if not float_is_zero(
                    payments[2]['amount'], precision_digits=prec_acc):
                order_id.add_payment(self._payment_fields(payments[2]))
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
                    """
                    If none, select for change one of the cash journals of
                    the POS
                    This is used for example when a customer pays by
                    credit card
                    an amount higher than total amount of the order and gets
                    cash back
                    """
                    cash_journal = [
                        statement.journal_id for statement in
                        pos_session.statement_ids
                        if statement.journal_id.type == 'cash']
                    if not cash_journal:
                        raise UserError(
                            _("No cash statement found for this session. \
                                Unable to record returned cash."))
                cash_journal_id = cash_journal[0].id
            order_id.add_payment({
                'amount': -pos_order['amount_return'],
                'payment_date': fields.Datetime.now(),
                'payment_name': _('return'),
                'journal': cash_journal_id,
            })
        return order_id

    @api.model
    def _cancel_reserved_order(self, order, order_id):
        line_data = list(order.get('lines'))
        temp = order.copy()
        temp.pop('statement_ids', None)
        temp.pop('name', None)
        temp.update({'date_order': order.get('creation_date')})
        for line in line_data:
            prod_dict = line[2]
            if prod_dict and order_id.config_id.refund_amount_product_id and \
               (prod_dict.get('product_id') ==
                order_id.config_id.prod_for_payment.id or
                    prod_dict.get('product_id') ==
                    order_id.config_id.refund_amount_product_id.id):
                temp.get('lines').remove(line)
            elif prod_dict and prod_dict.get('cancel_item'):
                for order_line in order_id.lines:
                    if order_line.product_id and order_line.product_id.id == \
                       prod_dict.get('product_id'):
                        if float(order_line.qty) == \
                           float(abs(prod_dict.get('qty'))):
                            order_line.unlink()
                        else:
                            order_line.qty = order_line.qty + \
                                prod_dict.get('qty')
                        temp.get('lines').remove(line)
                        break
        order_id.write(temp)
        order_id._onchange_amount_all()
        return self._process_order_payment(order, order_id)

    @api.model
    def _process_reservation_paid_amount(self, order, order_id=False):
        temp = order.copy()
        temp.update({'lines': order.get('paid_product_orderLines')})
        temp.update({'name': False})
        if order_id:
            temp.update({'reservation_order_pay_ref_id': order_id.id})
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
    def _process_order(self, order):
        draft_order_id = order.get('old_order_id')
        if draft_order_id:
            order_id = self.browse(draft_order_id)
            order.update({'session_id': order.get('pos_session_id')})
            order_id.write({'session_id': order.get('pos_session_id')})
            order.update({'date_order': order.get('creation_date')})
            # Cancel Reserved Order
            if order.get('cancel_order'):
                return self._cancel_reserved_order(order, order_id)
#            order_id.write({'reserved': order.get('reserved'),
#              'cancel_order': order.get('cancel_order'),
#              'won_loyalty_amounts': order.get('won_loyalty_amounts', 0),
#              'redeem_loyalty_amount' : order.get('redeem_loyalty_amount', 0),
#                            })
            temp = order.copy()
            temp.pop('statement_ids', None)
            temp.pop('name', None)
            temp.pop('lines', None)
            if order.get('reservation_ticket', False):
                order.update({'amount_return': 0})
                self._process_reservation_paid_amount(order, order_id)
                temp.update({'lines': order.get('update_product_orderLines')})
                order.update({'statement_ids': []})
            order_id.write(temp)
            order_id._onchange_amount_all()
            return self._process_order_payment(order, order_id)
        if not draft_order_id:
            if order.get('reservation_ticket', False):
                order.update({'amount_return': 0})
                temp = order.copy()
                order.update({'statement_ids': []})
                order_id = super(PosOrder, self)._process_order(order)
                order_id._onchange_amount_all()
                self._process_reservation_paid_amount(temp, order_id)
            else:
                order_id = super(PosOrder, self)._process_order(order)
            if order_id.reserved:
                order_id.do_internal_transfer()
            return order_id

    @api.model
    def ac_pos_search_read(self, domain):
        search_vals = self.search_read(domain, order='partner_id')
        user_id = self.env['res.users'].browse(self._uid)
        tz = False
        if self._context and self._context.get('tz'):
            tz = timezone(self._context.get('tz'))
        elif user_id and user_id.tz:
            tz = timezone(user_id.tz)
        if tz:
            c_time = datetime.now(tz)
            hour_tz = int(str(c_time)[-5:][:2])
            min_tz = int(str(c_time)[-5:][3:])
            sign = str(c_time)[-6][:1]
            result = []
            for val in search_vals:
                if sign == '-':
                    val.update({
                        'date_order':
                        (val.get('date_order') -
                            timedelta(hours=hour_tz, minutes=min_tz)).strftime(
                            '%Y-%m-%d %H:%M:%S')
                    })
                elif sign == '+':
                    val.update({
                        'date_order':
                        (val.get('date_order') +
                            timedelta(hours=hour_tz, minutes=min_tz)).strftime(
                            '%Y-%m-%d %H:%M:%S')
                    })
                result.append(val)
            return result
        else:
            return search_vals


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    cancel_item = fields.Boolean("Cancel Item")
    line_status = fields.Selection(
        [
            ('nothing', 'Nothing'),
            ('full', 'Fully Cancelled'),
            ('partial', 'Partially Cancelled')
        ],
        'Order Status', default="nothing")
    location_id = fields.Many2one('stock.location', string='Location')
    advance_pay = fields.Boolean('Advance Pay')


class StockPicking(models.Model):
    _inherit = "stock.picking"
    _order = "priority desc, date asc, id asc"

    pos_order_id = fields.Many2one('pos.order', string='Pos Order')


class StockMove(models.Model):
    _inherit = "stock.move"
    _order = 'date,picking_id,sequence,id'

    pos_order_id = fields.Many2one('pos.order',
                                   related='picking_id.pos_order_id',
                                   string='Pos Order')


class PosSession(models.Model):
    _inherit = 'pos.session'

    def _confirm_orders(self):
        for session in self:
            company_id = session.config_id.journal_id.company_id.id
            orders = session.order_ids.filtered(
                lambda order: order.state == 'paid')
            journal_id = self.env['ir.config_parameter'].sudo().get_param(
                'pos.closing.journal_id_%s' % company_id,
                default=session.config_id.journal_id.id)
            if not journal_id:
                raise UserError(_(
                    "You have to set a Sale Journal for the POS:%s") % (
                    session.config_id.name,))

            move = self.env['pos.order'].with_context(
                force_company=company_id)._create_account_move(
                session.start_at, session.name, int(journal_id), company_id)
            orders.with_context(
                force_company=company_id)._create_account_move_line(
                session,
                move)
            for order in session.order_ids.filtered(
                    lambda o: o.state not in ['done', 'invoiced']):
                if order.state not in ('draft', 'cancel'):
                    # raise UserError(
                    # ("You cannot confirm all orders of this session,
                    # because they have not the 'paid' status"))
                    order.action_pos_order_done()
            orders_to_reconcile = session.order_ids.filtered(
                lambda order: order.state in
                ['invoiced', 'done'] and order.partner_id)
            orders_to_reconcile.sudo()._reconcile_payments()

#    @api.multi
#    def action_pos_session_open(self):
#        pos_order = self.env['pos.order'].search([('state', '=', 'draft')])
#        for order in pos_order:
#            if order.session_id.state != 'opened':
#                order.write({'session_id': self.id})
#        return super(PosSession, self).action_pos_session_open()
