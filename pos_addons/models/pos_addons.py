# See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
from odoo.tools import float_is_zero
import odoo.addons.decimal_precision as dp


class ResPartner(models.Model):
    _inherit = 'res.partner'

    cash_register_sequence = fields.Integer(
        string='Cash register Sequence',
        default=99999,
    )

    @api.model
    def search(self, args, offset=0, limit=None, order=None, count=False):
        # if the order is passed through context then take that order
        order = self._context.get('order', order)
        return super(ResPartner, self).search(
            args=args, offset=offset, limit=limit, order=order, count=count
        )


class AccountBankStatementLine(models.Model):
    _inherit = 'account.bank.statement.line'

    to_bank = fields.Boolean()
    bank_out = fields.Boolean(
        string='Bank out',
        help='Is This money taken to the bank',
    )


class AccountJournalGroup(models.Model):
    _name = 'account.journal.group'

    name = fields.Char(
        string='Group name'
    )
    turnover = fields.Boolean(
        string='Turnover',
    )


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    group_code = fields.Many2one(
        comodel_name='account.journal.group',
        string='Group code',
        help='Group code is used to group on report journal overview'
             '/n if it is not filled in then it will not appear on the report',
    )


class PosSession(models.Model):
    _inherit = 'pos.session'

    cash_out_ids = fields.Many2many(
        comodel_name='account.bank.statement.line',
        string='Cash out references',
        compute='_compute_cash_out_ids',
    )
    remark = fields.Text(string='Remark')

    show_close_and_book = fields.Boolean(
        compute='_compute_checkcanclose',
    )

    @api.depends('cash_register_id.cashbox_end_id')
    def _compute_checkcanclose(self):
        for s in self:
            s.show_close_and_book = s.cash_register_id.cashbox_end_id

    @api.multi
    def _compute_cash_out_ids(self):
        for session in self:
            session.cash_out_ids = self.env['account.bank.statement.line']
            for statement in session.statement_ids.filtered(
                    lambda r: r.journal_id.type == 'cash'):
                session.cash_out_ids += statement.line_ids

    @api.multi
    def get_previous_session(self):
        prev_sessions = self.env['pos.session']
        for session in self:
            crit = [('config_id', '=', session.config_id.id),
                    ('stop_at', '<', session.stop_at)]
            prev_sessions += self.env['pos.session'].search(
                crit, order='stop_at desc', limit=1)
        return prev_sessions

    @api.multi
    def print_sale_overview(self):
        self.ensure_one()
        # create a wizard with the right data
        wiz = self.env['print.pos.overview'].create({
            'date_from': self.start_at,
            'allowed_shop_address_ids': [
                (6, 0, [self.config_id.shop_address_id.id]),
            ]
        })
        # print the form
        return wiz.print_report()

    @api.multi
    def action_pos_session_closing_control(self):
        # Check if there are sessions who are not having a closing balance
        if self.filtered(
                lambda r:
                not r.show_close_and_book and r.state == 'closing_control'):
            raise ValidationError(_('You should first set a closing balance.'))
        return super(PosSession, self).action_pos_session_closing_control()


class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'

#    collection_id = fields.Many2one(
#        related='product_id.collection_id',
#        string='Collection',
#        store=True,
#    )
    discount_amount = fields.Float(
        string='Amount discount',
        compute='_compute_discount_amount',
        store=True,
    )
    qty_left_on_location = fields.Float(
        string='Qty left on location',
        help='Qty left on this location',
        compute='_compute_qty_left_on_location',
        digits=dp.get_precision('Product Unit of Measure')
    )

    @api.multi
    @api.depends('discount', 'price_unit', 'qty')
    def _compute_discount_amount(self):
        for line in self:
            amt = (line.price_unit * line.qty) * line.discount / 100
            line.discount_amount = amt

    @api.multi
    @api.depends('product_id')
    def _compute_qty_left_on_location(self):
        for line in self:
            line.qty_left_on_location = line.product_id.with_context(
                location=line.order_id.location_id.id).qty_available


class PosOrder(models.Model):
    _inherit = 'pos.order'

    def create_picking(self):
        res = super(PosOrder, self).create_picking()
        if not res:
            return res
        for order in self:
            lines = order.lines.filtered(
                lambda l:
                l.product_id.type in ('product', 'consu') and not
                float_is_zero(
                    l.qty,
                    precision_rounding=l.product_id.uom_id.rounding,
                )
            )
            for line in lines:
                mvlines = order.picking_id.move_lines.filtered(
                    lambda ml:
                    ml.product_id.id == line.product_id.id and
                    ml.product_uom.id == line.product_id.uom_id.id and
                    ml.name == line.name and
                    ml.product_uom_qty == abs(line.qty) and not
                    ml.pos_order_line_id.id
                )
                # write only the pos order line id to the first ml found.
                # if multiple pos lines have same product/qty each line
                # needs to get its own ml
                if mvlines:
                    mvlines[0].write({'pos_order_line_id': line.id})
        return res

    def _action_create_invoice_line(self, line=False, invoice_id=False):
        res = super(PosOrder, self)._action_create_invoice_line(
            line=line, invoice_id=invoice_id
        )
        if res:
            attr_values = res.product_id.attribute_value_ids.filtered(
                lambda v: v.attribute_type in ('size', 'color')
            )
            if attr_values:
                name = '%s (%s)' % (
                    res.name, ', '.join(attr_values.mapped('name')))
                res.write({'name': name})
        return res


class StockMove(models.Model):
    _inherit = 'stock.move'

    pos_order_line_id = fields.Many2one(
        comodel_name='pos.order.line',
        string='POS Order Line'
    )
