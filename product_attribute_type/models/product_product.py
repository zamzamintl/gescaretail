# -*- coding: utf-8 -*-
from odoo import models, fields, api


class ProductProduct(models.Model):
    _inherit = 'product.product'
    _order = 'default_code, barcode, name, id'

    color_attribute_id = fields.Many2one(
        string="Color Attribute",
        comodel_name='product.attribute.value',
        compute="_get_attribute_types",
        store=True
    )
    size_attribute_id = fields.Many2one(
        string="Size Attribute",
        comodel_name='product.attribute.value',
        compute="_get_attribute_types",
        store=True
    )

    @api.depends('attribute_value_ids', 'attribute_value_ids.name')
    def _get_attribute_types(self):
        for record in self:
            for attribute_val in record.attribute_value_ids:
                if attribute_val.attribute_id.attribute_type == 'size':
                    record.size_attribute_id = attribute_val.id
                elif attribute_val.attribute_id.attribute_type == 'color':
                    record.color_attribute_id = attribute_val.id

    @api.multi
    def open_product_template(self):
        # Open the product template view in current instead of new
        res = super(ProductProduct, self).open_product_template()
        res.update({'target': 'current'})
        return res
