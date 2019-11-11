# See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class WizardAssignProductToConditionalSale(models.TransientModel):
    _name = 'wizard.assign.product.to.conditional.sale'

    product_conditional_discount_id = fields.Many2one(
        comodel_name='product.conditional.discount',
        string='Conditional discount',
    )

    @api.multi
    def assign(self):
        self.ensure_one()
        produdct_ids = \
            self.product_conditional_discount_id.product_template_discount_ids
        product_id = [pro_rec.product_tmpl_id.id for pro_rec in produdct_ids]
        product_li = []
        for rec in self.env.context.get('active_ids'):
            if rec not in product_id:
                product_li.append((0, 0, {
                    'product_tmpl_id': rec,
                    'discount': 0.0
                }))
        self.product_conditional_discount_id.write({
            'product_template_discount_ids': product_li
        })
