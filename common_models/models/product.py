# -*- coding: utf-8 -*-
from odoo import models, fields, api


class ProductAttributeLine(models.Model):
    _name = "product.template.attribute.line"
    _inherit = "product.template.attribute.line"
    _order = "sequence"

    sequence = fields.Integer(compute="_compute_sequence", store=True)

    def _compute_sequence(self):
        for attr_line in self:
            if attr_line.sequence == 0:
                attr_line.sequence = attr_line.id


class ProductProduct(models.Model):
    _name = "product.product"
    _inherit = "product.product"
    _order = "name,sequence"

    sequence = fields.Integer(compute="_compute_sequence", store=True)

    @api.depends("attribute_value_ids", "attribute_value_ids.sequence")
    def _compute_sequence(self):
        for product in self:
            if not len(product.attribute_value_ids):
                continue
            if product.attribute_value_ids[0].sequence != 0:
                product.sequence = product.attribute_value_ids[0].sequence
            else:
                product.sequence = product.attribute_value_ids[0].id


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    model_size_attribute = fields.Many2one(
        comodel_name='product.attribute',
        string='Size grouping',
        domain=[('attribute_type', '=', 'size')],
    )
    model_color_attribute = fields.Many2one(
        comodel_name='product.attribute',
        string='Color grouping',
        domain=[('attribute_type', '=', 'color')],
    )
    product_brand_id = fields.Many2one(
        old_name='brand'
    )

    @api.model_create_multi
    def create(self, vals_list):
        for record in vals_list:
            if 'model_color_attribute' in record:
                if record.get('model_color_attribute'):
                    attribute_id = self.env['product.attribute'].browse(
                        [record['model_color_attribute']])
                    if 'attribute_line_ids' not in record:
                        record['attribute_line_ids'] = []
                    record['attribute_line_ids'].append(
                        [
                            0, False,
                            {'value_ids':
                             [[6, False, attribute_id.value_ids.ids]],
                             'attribute_id': attribute_id.id}
                        ]
                    )
            if 'model_size_attribute' in record:
                if record.get('model_size_attribute'):
                    attribute_id = self.env['product.attribute'].browse(
                        [record['model_size_attribute']])
                    if 'attribute_line_ids' not in record:
                        record['attribute_line_ids'] = []
                    record['attribute_line_ids'].append(
                        [
                            0, False,
                            {'value_ids':
                             [[6, False, attribute_id.value_ids.ids]],
                             'attribute_id': attribute_id.id}
                        ]
                    )
        templates = super(ProductTemplate, self).create(vals_list)
        templates.create_variant_ids()
        return templates

    @api.multi
    def create_variant_ids(self):
        res = super(ProductTemplate, self).create_variant_ids()
        self.product_variant_ids.write({
            'lst_price': self.lst_price,
            'list_price': self.list_price
        })
        return res

    @api.model
    def create_model(self, name, list_price, standard_price, attribute_size_id,
                     attribute_color_id, collection_id, product_brand_id):
        vals = {
            'name': name,
            'list_price': list_price,
            'standard_price': standard_price,
            'model_size_attribute': attribute_size_id,
            'model_color_attribute': attribute_color_id,
            'ad_purchase_cost': standard_price,
            'collection_id': collection_id,
            'product_brand_id': product_brand_id,
        }

        product_template = self.env['product.template'].create(vals)

        return product_template.id
