from odoo import models, fields, api


class ProductBrand(models.Model):
    _name = 'product.brand'
    _description = 'Product brands'

    active = fields.Boolean("Active", default=True)
    name = fields.Char(
        string='Name',
    )

    logo = fields.Binary('Logo File')

    product_ids = fields.One2many(
        'product.template',
        'product_brand_id',
        string='Brand Products',
    )
    products_count = fields.Integer(
        string='Number of products',
        compute='_get_products_count',
    )

    # TODO: rename this field to partner_ids bc the relation is res_partner
    vendor_ids = fields.Many2many(
        comodel_name='res.partner',
        string='Vendors',
        relation='product_brand_res_partner_rel',
        column1='product_brand_id',
        column2='res_partner_id'
    )

    @api.one
    @api.depends('product_ids')
    def _get_products_count(self):
        self.products_count = len(self.product_ids.ids)

    @api.multi
    def toggle_active(self):
        for record in self:
            record.active = not record.active
