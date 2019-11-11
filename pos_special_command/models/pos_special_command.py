# See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class PosOrder(models.Model):
    _inherit = "pos.order"

    internal_reservation = fields.Boolean(
        "Internal Reservation",
        readonly=True)
    is_picking_done = fields.Boolean(
        "Is picking done",
        readonly=True)

    def _order_fields(self, ui_order):
        res = super(PosOrder, self)._order_fields(ui_order)
        res.update({
            'internal_reservation':
            ui_order.get('internal_reservation') or False,
            'is_picking_done':
            ui_order.get('is_picking_done', False)
        })
        return res

    @api.multi
    def internal_reserved_to_stock_picking(self, order_id):
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
                            order.config_id.reserve_stock_location_id.id,
                            'location_dest_id':
                            order.config_id.stock_location_id.id,
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
                            order.config_id.reserve_stock_location_id.id,
                            'location_dest_id':
                            order.config_id.stock_location_id.id,
                            'state': 'draft',
                            'move_lines': temp_move_lines,
                            'origin': order.name,
                            'pos_order_id': order.id
                        }
                        picking_obj = self.env['stock.picking'].create(
                            picking_vals)
                        if picking_obj:
                            picking_obj.action_confirm()
                            picking_obj.button_validate()
                            wiz_data = picking_obj.button_validate()
                            if wiz_data and wiz_data.get('res_model', False) \
                                    and wiz_data.get('res_id', False):
                                self.env[wiz_data['res_model']].browse(
                                    wiz_data['res_id']).process()
                            order.picking_id = picking_obj.id

    @api.multi
    def internal_other_stock_to_reserved_picking(self, order_id):
        for order in self:
            if order.config_id.reserve_stock_location_id and \
               order.picking_id and order.picking_id.location_id:
                picking_status = order.picking_id.state
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
                            order.picking_id.location_id.id,
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
                            order.picking_id.location_id.id,
                            'location_dest_id':
                            order.config_id.reserve_stock_location_id.id,
                            'state': 'draft',
                            'move_lines': temp_move_lines,
                            'origin': order.name,
                            'pos_order_id': order.id
                        }
                        picking_obj = self.env['stock.picking'].create(
                            picking_vals)
                        if picking_obj:
                            if picking_status == 'assigned':
                                picking_obj.action_confirm()
                                picking_obj.button_validate()
                            else:
                                picking_obj.action_confirm()
                            order.picking_id.action_cancel()
                            order.picking_id = picking_obj.id

    @api.multi
    def action_pos_order_paid(self):
        if not self.test_paid():
            if self.cancel_order:
                if self.internal_reservation:
                    if self.picking_id and (
                            self.picking_id.state == 'confirmed' or
                            self.picking_id.state == 'assigned'):
                        self.internal_other_stock_to_reserved_picking(self)
                    elif self.picking_id and self.picking_id.state != 'cancel':
                        self.internal_reserved_to_stock_picking(self)
                        self.do_internal_transfer()
                else:
                    self.reserved_to_stock_picking(self)
                    self.do_internal_transfer()
            raise UserError(_("Order is not paid."))
        self.write({'state': 'paid'})
        if self.is_picking_done and self.internal_reservation:
            if self.cancel_order:
                if self.picking_id and (
                        self.picking_id.state == 'confirmed' or
                        self.picking_id.state == 'assigned'):
                    flag = False
                    for order in self:
                        if not order.lines.filtered(
                            lambda l: l.product_id.type in [
                                'product', 'consu']):
                            continue
                        else:
                            flag = True
                    if flag:
                        self.internal_other_stock_to_reserved_picking(self)
                    else:
                        self.picking_id.action_cancel()
                    return True
                elif self.picking_id and self.picking_id.state != 'cancel':
                    self.reserved_to_stock_picking(self)
            else:
                self.internal_reserved_to_stock_picking(self)
        elif self.is_picking_done and\
                (self.cancel_order or self.delivery_date):
            self.reserved_to_stock_picking(self)
        if not self.is_picking_done:
            if self.picking_id:
                self.picking_id.action_cancel()
        picking = self.create_picking()
        if self.picking_id:
            self.picking_id.pos_order_id = self.id
        return picking

    def do_special_command_internal_transfer(self, vals, pos_order):
        move_lines = []
        if vals:
            for move_line in vals.get('moveLines'):
                move_lines.append((0, 0, move_line))
            picking_vals = {
                'picking_type_id': vals.get('picking_type_id'),
                'location_id': vals.get('location_src_id'),
                'location_dest_id': vals.get('location_dest_id'),
                'state': 'draft',
                'move_lines': move_lines,
                'origin': pos_order.name,
                'pos_order_id': pos_order.id,
            }
            picking_id = self.env['stock.picking'].create(picking_vals)
            if picking_id:
                if vals.get('state') == 'confirmed':
                    picking_id.action_confirm()
                if vals.get('state') == 'done':
                    picking_id.action_confirm()
                    wiz_data = picking_id.button_validate()
                    if wiz_data and wiz_data.get('res_model', False) and \
                            wiz_data.get('res_id', False):
                        self.env[wiz_data['res_model']].browse(
                            wiz_data['res_id']).process()
                pos_order.picking_id = picking_id.id
        return picking_id.id

    @api.multi
    def send_special_command_mail(self, picking_id):
        try:
            template_id = \
                self.env['ir.model.data'].get_object_reference(
                    'pos_special_command',
                    'special_command_email_template_picking_confirmation')
            template_obj = self.env['mail.template'].browse(template_id[1])
            template_obj.send_mail(
                picking_id.id,
                force_send=True,
                raise_exception=True)
        except:
            pass

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
#                            'cancel_order': order.get('cancel_order')
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
            order_id = super(PosOrder, self)._process_order(order)
            if order_id.internal_reservation:
                internal_resveration_data = order.get(
                    'internal_resveration_data')
                if internal_resveration_data:
                    order_id.do_special_command_internal_transfer(
                        internal_resveration_data, order_id)
            return order_id
