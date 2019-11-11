# -*- coding: utf-8 -*-
from odoo import models, api, fields, _
from odoo.exceptions import ValidationError


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    product_brand_id = fields.Many2one(
        comodel_name='product.brand',
        string='Brand',
        help='Select a brand for this product'
    )
    vendor_id = fields.Many2one(
        string='Vendor',
        comodel_name='res.partner',
    )
    brand_vendor_ids = fields.Many2many(related='product_brand_id.vendor_ids')

    @api.multi
    def update_seller_ids(self):
        self.ensure_one()
        if self.env.context.get('skip_update_seller_ids'):
            # avoid write loop !
            return
        if not self.vendor_id:
            raise ValidationError(
                _('Product %s has no supplier!') % self.name
            )
        sellers_to_update = self.seller_ids.filtered(
            lambda s: s.name != self.vendor_id
        )
        sellers_to_update.with_context(skip_update_seller_ids=True).write({
            'name': self.vendor_id.id
        })
        seller_variant_ids = self.seller_ids.mapped('product_id')
        missing_seller_variants = self.product_variant_ids - seller_variant_ids
        self.with_context(skip_update_seller_ids=True).write({
            'seller_ids': [
                (0, 0, {
                    'name': self.vendor_id.id,
                    'product_id': p.id,
                    'product_tmpl_id': p.product_tmpl_id.id,
                    'price': p.standard_price,
                }) for p in missing_seller_variants
            ],
        })

    @api.onchange('product_brand_id')
    def set_vendor_id(self):
        self.ensure_one()
        if self.product_brand_id.vendor_ids:
            self.vendor_id = self.product_brand_id.vendor_ids[0]
            return {
                'domain': {
                    'vendor_id': [
                        ('id', 'in', self.product_brand_id.vendor_ids.ids)]
                }
            }
        else:
            return {'domain': {'vendor_id': [('supplier', '=', True)]}}

    @api.model
    def create(self, vals):
        template = super(ProductTemplate, self).create(vals)
        return template

    @api.multi
    def write(self, vals):
        res = super(ProductTemplate, self).write(vals)
        if vals.get('vendor_id'):
            for rec in self:
                rec.update_seller_ids()
        return res

    @api.multi
    def copy(self, default=None):
        self.ensure_one()
        res = super(ProductTemplate, self).copy(default=default)
        return res
