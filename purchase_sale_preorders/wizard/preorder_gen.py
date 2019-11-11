# -*- coding: utf-8 -*-
from odoo import models, api, fields


class PurchasePreorderLine(models.TransientModel):
    _name = "purchase.preorder.line"

    product_id = fields.Many2one(
        comodel_name="product.product"
    )
    order_ref = fields.Char(
        string="Order Ref"
    )
    purchase_preorder_id = fields.Many2one(
        comodel_name="purchase.preorder"
    )


class PurchasePreorder(models.TransientModel):
    _name = "purchase.preorder"
    _description = "Generate purchase orders"

    collection_id = fields.Many2one(
        comodel_name="product.collection",
        string="Collection",
        required=True
    )
    order_line_error_ids = fields.One2many(
        comodel_name="purchase.preorder.line",
        inverse_name="purchase_preorder_id"

    )

    @api.multi
    def gen_preorder(self):
        orders = self.env['sale.order'].search(
            [('collection_id', '=', self.collection_id.id),
             ('state', '=', 'sale'),
             ('is_preorder', '=', 'True'),
             ('invoice_status', '=', 'no'),
             ('preorder_complete', '=', False)]
        )
        order_line_ids = self.env['sale.order.line'].search(
            [('order_id', 'in', orders.ids), ('product_uom_qty', '>', 0)])
        products_without_suppliers = order_line_ids.filtered(
            lambda r: len(r.product_id.product_tmpl_id.seller_ids.ids) < 1)

        if any(products_without_suppliers):
            for line in products_without_suppliers:
                self.order_line_error_ids += \
                    self.env['purchase.preorder.line'].new({
                        'product_id': line.product_id,
                        'order_ref': line.order_id.name
                    })

            return {
                'type': 'ir.actions.act_window',
                'res_model': 'purchase.preorder',
                'view_type': 'form',
                'view_mode': 'form',
                'res_id': self.id,
                'target': 'new',
            }

        seller_ids = list(set(order_line_ids.mapped(
            lambda r: r.product_id.product_tmpl_id.seller_ids)))
        vendor_ids = list(set(map(lambda x: x.name, seller_ids)))

        for partner_id in vendor_ids:
            po = self.env['purchase.order'].search(
                [('partner_id', '=', partner_id.id), ('state', '=', 'draft')])
            order_lines = order_line_ids
            order_ids = list(set(order_lines.mapped('order_id')))

            if not po:
                new_lines = []
                new_po = self.env['purchase.order'].create({
                    'partner_id': partner_id.id,
                    'date_order': order_ids[0].ad_po_date
                })

                for line in order_lines:
                    if not new_po.partner_id:
                        new_po.fiscal_position_id = False
                        new_po.payment_term_id = False
                        new_po.currency_id = False
                    else:
                        new_po.fiscal_position_id = new_po.partner_id. \
                            property_account_position_id.id
                        new_po.payment_term_id = new_po.partner_id. \
                            property_supplier_payment_term_id.id
                        new_po.currency_id = \
                            new_po.partner_id. \
                            property_purchase_currency_id.id \
                            or new_po.env.user.company_id.currency_id.id

                        fpos = new_po.fiscal_position_id or \
                            new_po.partner_id.property_account_position_id
                        # If company_id is set,
                        # always filter taxes by the company
                        taxes = line.product_id.supplier_taxes_id.filtered(
                            lambda r: not new_po.company_id
                            or r.company_id == new_po.company_id
                        )
                        fp_taxes = fpos.map_tax(
                            taxes, line.product_id, new_po.partner_id
                        ) if fpos else taxes

                        update_line = list(filter(
                            lambda x: line.product_id.id == x[2].get(
                                'product_id'), new_lines))

                        if not update_line:
                            supplier = self.env['product.supplierinfo'].search(
                                [('name.id', '=', partner_id.id),
                                 ('product_id', '=', line.product_id.id)])
                            if not supplier:
                                supplier = self.env['product.supplierinfo']\
                                    .search([('name.id', '=', partner_id.id),
                                             ('product_tmpl_id', '=',
                                              line.product_id.
                                              product_tmpl_id.id)])

                            new_lines.append((0, 0, {
                                'product_id': line.product_id.id,
                                'order_id': new_po.id,
                                'order_model_id': line.order_model_id,
                                'ad_is_model_variant':
                                line.ad_is_model_variant,
                                'name': line.product_id.name,
                                'date_planned':
                                    list(filter(
                                        lambda x: x.id == line.order_id.id,
                                        order_ids))[0].ad_po_date,
                                'product_qty': line.product_uom_qty,
                                'taxes_id': [[6, 0, fp_taxes.ids]],
                                'product_uom': line.product_id.uom_po_id.id,
                                'price_unit': supplier.price if supplier else
                                line.product_id.ad_purchase_cost
                            }))
                        else:
                            for new_line in new_lines:
                                if new_line[2].get('product_id') == \
                                        update_line[0][2].get('product_id'):
                                    new_line[2][
                                        'product_qty'] += line.product_uom_qty
                new_po.write({'order_line': new_lines})
            else:
                new_lines = []

                for line in order_lines:
                    po_line = self.env['purchase.order.line'].search(
                        [('order_id', 'in', po.ids),
                         ('product_id', '=', line.product_id.id)], limit=1)

                    if po_line:
                        po_line.product_qty += line.product_uom_qty
                    else:
                        fpos = po.fiscal_position_id or po.partner_id. \
                            property_account_position_id
                        # If company_id is set, always filter
                        # taxes by the company
                        taxes = line.product_id.supplier_taxes_id.filtered(
                            lambda r: not po.company_id
                            or r.company_id == po.company_id
                        )
                        fp_taxes = fpos.map_tax(
                            taxes, line.product_id, po.partner_id
                        ) if fpos else taxes

                        supplier = self.env['product.supplierinfo'].search(
                            [('name.id', '=', partner_id.id),
                             ('product_id', '=', line.product_id.id)])
                        if not supplier:
                            supplier = self.env['product.supplierinfo']\
                                .search([('name.id', '=', partner_id.id),
                                         ('product_tmpl_id', '=',
                                          line.product_id.product_tmpl_id.id)])

                        new_lines.append((0, 0, {
                            'product_id': line.product_id.id,
                            'order_id': po.id,
                            'order_model_id': line.order_model_id,
                            'ad_is_model_variant': line.ad_is_model_variant,
                            'name': line.product_id.name,
                            'date_planned':
                                list(filter(lambda x: x.id == line.order_id.id,
                                            order_ids))[0].ad_po_date,
                            'product_qty': line.product_uom_qty,
                            'taxes_id': [[6, 0, fp_taxes.ids]],
                            'product_uom': line.product_id.uom_po_id.id,
                            'price_unit': supplier.price if supplier else
                            line.product_id.ad_purchase_cost
                        }))

                po.write({'order_line': new_lines})

        for order in orders:
            order.preorder_complete = True

        return {
            'type': 'ir.actions.act_window',
            'res_model': 'purchase.preorder',
            'view_type': 'form',
            'view_mode': 'form',
            'res_id': self.id,
            'target': 'new',
        }
