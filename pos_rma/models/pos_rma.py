# See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class PosOrder(models.Model):
    _inherit = "pos.order"

    return_order = fields.Char('Return Order ID', size=64)

    @api.model
    def _order_fields(self, ui_order):
        res = super(PosOrder, self)._order_fields(ui_order)
        res.update({'return_order': ui_order.get('return_order', '')})
        return res

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
                    pos_line_obj = self.env['pos.order.line']
                    to_be_returned_items = {}
                    for line in order.get('lines'):
                        if line[2].get('return_process'):
                            if line[2].get('product_id') in \
                                    to_be_returned_items:
                                to_be_returned_items[line[2].get(
                                    'product_id')] = to_be_returned_items[
                                    line[2].get('product_id')] + line[2].get(
                                    'qty')
                            else:
                                to_be_returned_items.update({line[2].get(
                                    'product_id'): line[2].get('qty')})
                    for line in order.get('lines'):
                        for item_id in to_be_returned_items:
                            for origin_line in self.browse([line[2].get(
                                    'return_process')]).lines:
                                if to_be_returned_items[item_id] == 0:
                                    continue
                                if origin_line.return_qty > 0 and item_id == \
                                        origin_line.product_id.id:
                                    if (to_be_returned_items[item_id] * -1) >=\
                                            origin_line.return_qty:
                                        ret_from_line_qty = 0
                                        to_be_returned_items[item_id] = \
                                            to_be_returned_items[item_id] + \
                                            origin_line.return_qty
                                    else:
                                        ret_from_line_qty = \
                                            to_be_returned_items[item_id] + \
                                            origin_line.return_qty
                                        to_be_returned_items[item_id] = 0
                                    pos_line_obj.browse([origin_line.id]).\
                                        write(
                                            {'return_qty': ret_from_line_qty})
        return order_ids


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    return_qty = fields.Integer('Return QTY', size=64)
    return_process = fields.Char('Return Process')
