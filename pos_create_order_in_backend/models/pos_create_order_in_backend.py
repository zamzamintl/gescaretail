# See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api, _
from odoo.exceptions import UserError
from odoo.tools import float_is_zero


class ReturnPicking(models.TransientModel):
    _inherit = 'stock.return.picking'

    def _prepare_move_default_values(self, return_line, new_picking):
        res = super(ReturnPicking, self)._prepare_move_default_values(
            return_line=return_line,
            new_picking=new_picking)
        if res:
            res.update({'quantity_done': return_line.quantity})
        return res


class PosOrder(models.Model):
    _inherit = 'pos.order'

    def _default_session(self):
        return self.env['pos.session'].search([('state', '=', 'opened'),
                                               ('user_id', '=', self.env.uid)],
                                              limit=1)

    @api.model
    def reverse_picking(self):
        picking_out = self.picking_id
        if picking_out:
            # Create return picking for all goods
            picking_return = self.env['stock.return.picking']
            default_data = picking_return.with_context({
                'active_ids': picking_out.ids,
                'active_id': picking_out.id}
            ).default_get(picking_return._fields)
            return_wiz = self.env['stock.return.picking']\
                .with_context({'active_ids': picking_out.ids,
                               'active_id': picking_out.id})\
                .create(default_data)
            res = return_wiz.create_returns()
            return_pick = self.env['stock.picking'].browse(res['res_id'])
            wiz_data = return_pick.button_validate()
            if wiz_data and wiz_data.get('res_model', False) and \
                    wiz_data.get('res_id', False):
                self.env[wiz_data['res_model']].browse(
                    wiz_data['res_id']).process()
            self.picking_id = return_pick.id

    @api.multi
    def Create_new_order(self, invoice_order):
        """Create a copy of order  for new order"""
        PosOrder = self.env['pos.order']
        for order in self:
            clone = order.copy({
                'name': order.name + _(' NEW ORDER'),
                'session_id': order.session_id.id,
                'date_order': order.date_order,
                'booked': True,
                'invoice_order': invoice_order,
                'pos_reference': order.pos_reference,
                'amount_paid': 0,
            })
            PosOrder += clone

        return {
            'name': _('Return Products'),
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'pos.order',
            'res_id': PosOrder.ids[0],
            'view_id': False,
            'context': self.env.context,
            'type': 'ir.actions.act_window',
            'target': 'current',
        }

    @api.multi
    def correct_ticket(self):
        for order in self:
            partner = order.partner_id
            currency = order.company_id.currency_id
            # Reverse Loyalty Amount
            if partner and order.is_loyalty_install():
                partner.loyalty_amounts = currency.round(
                    partner.loyalty_amounts - order.won_loyalty_amounts)
                partner.loyalty_amounts = currency.round(
                    partner.loyalty_amounts + order.redeem_loyalty_amount)
                order.won_loyalty_amounts = 0
                order.redeem_loyalty_amount = 0
                if partner.loyalty_amounts < 0:
                    partner.loyalty_amounts = 0
            # Reverse Picking
            order.reverse_picking()
            invoice_order = False
            if order.state == 'invoiced':
                invoice_order = True
                invoice_refund_obj = self.env['account.invoice.refund']
                filter_refund = 'refund'
                if order.session_id.state == 'opened':
                    filter_refund = 'cancel'
                self.account_invoice_refund_0 = \
                    invoice_refund_obj.create(dict(
                        description='Refund Invoice',
                        date=order.invoice_id.date_invoice,
                        date_invoice=order.invoice_id.date_invoice,
                        filter_refund=filter_refund
                    ))
                self.account_invoice_refund_0.with_context(
                    active_ids=order.invoice_id.ids,
                    active_id=order.invoice_id.ids[0],
                    order_ids=order.ids,
                    is_pos_order=True,
                    invoice_order=True,
                ).invoice_refund()
            # Remove account bank statement line
            flag = False
            for statement in order.statement_ids:
                if statement and order.state not in ['done', 'invoiced']:
                    statement.unlink()
                elif order.state in ['done', 'invoiced']:
                    if statement.statement_id and \
                       statement.statement_id.state != "open":
                        statement.statement_id.state = "open"
                        flag = True
                    order.add_payment({
                        'amount': - statement.amount or 0.0,
                        'payment_date': statement.date,
                        'payment_name': _('return'),
                        'journal': statement.journal_id.id,
                    })
            if flag:
                order.session_id.action_pos_session_closing_control()
                if order.session_id.config_id.cash_control:
                    order.session_id.action_pos_session_close()
            # Cancel Current order
            order.state = 'cancel'
            # Create new Order
            return order.Create_new_order(invoice_order)
        return False

    @api.onchange('session_id')
    def _onchange_session_id(self):
        if self.session_id and self.booked:
            self.date_order = self.session_id.start_at

    @api.model
    def is_loyalty_install(self):
        try:
            if self.company_id.loyalty_percentage:
                return True
        except Exception:
            return False
        return False

    @api.model
    def ignore_product(self, product_id):
        config_id = self.config_id
        try:
            if config_id.refund_amount_product_id.id == product_id:
                return True
            elif config_id.prod_for_payment.id == product_id:
                return True
            elif config_id.cancellation_charges_product_id.id == product_id:
                return True
            elif config_id.discount_product_id.id == product_id:
                return True
        except Exception:
            return False
        return False

    @api.model
    def ignor_for_loyalty(self, product):
        if product.ignor_for_loyalty:
            return True
        return False

    @api.depends('statement_ids', 'lines.price_subtotal_incl',
                 'lines.discount')
    def _cal_max_loyalty_amount(self):
        for order in self:
            order.max_loyalty_amount_total = 0.0
            if order.partner_id and order.is_loyalty_install():
                currency = order.company_id.currency_id
                loyalty_totaltax =\
                    currency.round(sum(self._amount_line_tax
                                       (line, order.fiscal_position_id)
                                       for line in order.lines
                                       if line.discount == 0.0 and
                                       not order.ignor_for_loyalty(
                                           line.product_id) and
                                       not order.ignore_product(
                                           line.product_id.id)
                                       ))
                loyalty_total_amount_untaxed = \
                    currency.round(sum(line.price_subtotal
                                       for line in order.lines
                                       if line.discount == 0.0 and
                                       not order.ignor_for_loyalty(
                                           line.product_id) and
                                       not order.ignore_product(
                                           line.product_id.id)))
                order.max_loyalty_amount_total = \
                    loyalty_totaltax + loyalty_total_amount_untaxed

    @api.model
    def calculate_loyalty_amount(self):
        partner = self.partner_id
        if partner and self.is_loyalty_install():
            currency = partner.company_id.currency_id
            maximum_loyalty = self.max_loyalty_amount_total
            total_amount = self.amount_total
            loyalty_percentage = self.company_id.loyalty_percentage
            if total_amount >= maximum_loyalty:
                total_amount = maximum_loyalty
            self.won_loyalty_amounts = currency.round((
                total_amount * loyalty_percentage) / 100)
            partner.loyalty_amounts = currency.round(partner.loyalty_amounts +
                                                     self.won_loyalty_amounts)
            if partner.loyalty_amounts < 0:
                partner.loyalty_amounts = 0
        return True

    @api.onchange('session_id')
    def onchange_session_id(self):
        if self.config_id and \
           self.config_id.pricelist_id:
            self.pricelist_id = self.config_id.pricelist_id.id

    booked = fields.Boolean('Booked')
    invoice_order = fields.Boolean('Invoice Order')
    session_id = fields.Many2one(
        'pos.session', string='Session', required=True, index=True,
        domain="[]",
        states={'draft': [('readonly', False)]},
        readonly=True, default=_default_session)
    date_order = fields.Datetime(string='Order Date',
                                 readonly=False,
                                 index=True,
                                 default=fields.Datetime.now)
    max_loyalty_amount_total = fields.Float(compute='_cal_max_loyalty_amount',
                                            string='Max Loyalty Total',
                                            digits=0)


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
                raise UserError(
                    _("You have to set a Sale Journal for the POS:%s") % (
                        session.config_id.name,))

            move = self.env['pos.order'].with_context(
                force_company=company_id)._create_account_move(
                session.start_at, session.name, int(journal_id), company_id)
            orders.with_context(
                force_company=company_id)._create_account_move_line(
                session, move)
            for order in session.order_ids.filtered(
                    lambda o: o.state not in ['done', 'invoiced']):
                if order.state not in ('draft', 'cancel'):
                    # raise UserError(
                    # _("You cannot confirm all orders of this session,
                    # because they have not the 'paid' status"))
                    order.action_pos_order_done()
            orders_to_reconcile = session.order_ids.filtered(
                lambda order: order.state in ['invoiced', 'done'] and
                order.partner_id)
            orders_to_reconcile.sudo()._reconcile_payments()

    @api.multi
    def action_pos_session_closing_control(self):
        self._check_pos_session_balance()
        for session in self:
            stop_at = fields.Datetime.now()
            if session.stop_at:
                stop_at = session.stop_at
            session.write({'state': 'closing_control', 'stop_at': stop_at})
            if not session.config_id.cash_control:
                session.action_pos_session_close()


class PosMakePayment(models.TransientModel):
    _inherit = 'pos.make.payment'

    @api.multi
    def check(self):
        """Check the order:
        if the order is not paid: continue payment,
        if the order is paid print ticket.
        """
        self.ensure_one()
        order = self.env['pos.order'].browse(
            self.env.context.get('active_id', False))
        currency = order.pricelist_id.currency_id
        amount = order.amount_total - order.amount_paid
        data = self.read()[0]
        # add_payment expect a journal key
        data['journal'] = data['journal_id'][0]
        data['amount'] = currency.round(
            data['amount']) if currency else data['amount']
        if not float_is_zero(amount, precision_rounding=currency.rounding or
                             0.01):
            order.add_payment(data)
        if order.test_paid():
            order.action_pos_order_paid()
            if order.booked:
                flag = False
                date_order = order.date_order
                if date_order:
                    date_order = date_order.strftime('%Y-%m-%d')
                if order.picking_id:
                    order.picking_id.min_date = date_order
                for statement in order.statement_ids:
                    statement.date = date_order
                    if statement.statement_id and \
                       statement.statement_id.state != "open":
                        statement.statement_id.state = "open"
                        flag = True
                order.calculate_loyalty_amount()
                if order.invoice_order:
                    order.action_pos_order_invoice()
                    order.invoice_id.sudo().action_invoice_open()
                    order.account_move = order.invoice_id.move_id
                if flag:
                    order.session_id.action_pos_session_closing_control()
                    if order.session_id.config_id.cash_control:
                        order.session_id.action_pos_session_close()
            return {'type': 'ir.actions.act_window_close'}
        return self.launch_payment()
