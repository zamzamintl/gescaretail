# See LICENSE file for full copyright and licensing details.

from odoo import models, api, _


class ProductTemplate(models.Model):

    _inherit = 'product.template'

    @api.multi
    def action_stock_moves_views(self):
        treeview_ref = self.env.ref(
            'pos_stock_move.stock_move_tree_view', False)
        domain = [('product_id.product_tmpl_id', 'in', self.ids)]
        products = self.mapped('product_variant_ids')
        action = {
            'name': _("Stock Moves"),
            'view_mode': 'tree, form',
            'view_id': False,
            'view_type': 'form',
            'res_model': 'stock.move',
            'type': 'ir.actions.act_window',
            'target': 'current',
            'domain': domain,
            'views': [(treeview_ref and treeview_ref.id or False, 'tree'),
                      (False, 'form')],
        }
        if products:
            action['context'] = {'default_product_id': products.ids[0],
                                 'search_default_groupby_colorattribute': 1,
                                 'search_default_state': 1
                                 }
        return action

    @api.multi
    def action_view_stock_moves(self):
        products = self.mapped('product_variant_ids')
        action = self.env.ref('stock.act_product_stock_move_open').read()[0]
        if products:
            action['context'] = {'default_product_id': products.ids[0],
                                 'search_default_group_color_attribute': 1,
                                 'search_default_group_size_attribute': 1
                                 }
        action['domain'] = [('product_id.product_tmpl_id', 'in', self.ids)]
        return action
