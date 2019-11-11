# See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api
from odoo.exceptions import Warning, UserError


class ProductConditionalDiscount(models.Model):
    _name = 'product.conditional.discount'

    name = fields.Char(string="Name", required=True)
    discount = fields.Float(
        string="Discount Percentage Base",
        default=0.0,
        required=True)
    start_date = fields.Date(string="Startdatum")
    end_date = fields.Date(string="Einddatum")

    product_conditional_steps = fields.One2many(
        string="Product Conditional Steps",
        comodel_name="product.conditional.step",
        inverse_name="conditional_discount_id")

    product_template_discount_ids = fields.One2many(
        comodel_name="product.template.conditional.discount",
        inverse_name="conditional_discount_id",
        string="Special discount for Products")

    @api.constrains('product_template_discount_ids', 'start_date', 'end_date')
    def _check_product(self):
        pro_rec = []
        dpro_rec = []
        for product_rec in self.product_template_discount_ids:
            if product_rec.product_tmpl_id and \
                    product_rec.product_tmpl_id.id not in pro_rec:
                pro_rec.append(product_rec.product_tmpl_id.id)
            elif product_rec.product_tmpl_id and \
                    product_rec.product_tmpl_id.id in pro_rec:
                dpro_rec.append(product_rec.id)
        dquery = ""
        if len(dpro_rec) == 1:
            dquery = '''
                delete from product_template_conditional_discount
                where id  = ''' + \
                str(dpro_rec[0]) + ''';'''
        elif len(dpro_rec) > 1:
            dquery = '''
                delete from product_template_conditional_discount
                where id in ''' + \
                str(tuple(dpro_rec)) + ''';'''
        if dquery:
            self._cr.execute(dquery)
            self._cr.commit()
        start_date = self.start_date
        end_date = self.end_date
        if start_date > end_date:
            raise Warning("End date must be less than to start date.")
        rec = {}
        if pro_rec:
            self._cr.execute('''
            select * from product_conditional_discount pc Left join
            product_template_conditional_discount pt on(
            pt.conditional_discount_id = pc.id)
            where pc.id != %s and pt.product_tmpl_id in %s and (((
            pc.start_date between %s and %s) or
            (pc.end_date between %s and %s)) or
            (pc.start_date = %s and pc.end_date = %s) or
            (%s between pc.start_date and pc.end_date) or
            (%s between pc.start_date and pc.end_date))''', (self.id,
                                                             tuple(pro_rec),
                                                             start_date,
                                                             end_date,
                                                             start_date,
                                                             end_date,
                                                             start_date,
                                                             end_date,
                                                             start_date,
                                                             end_date
                                                             ))
            rec = self._cr.dictfetchall()
        if rec:
            product_li = []
            waring_str = "@@@@warning@@@@"
            for product_tmpl_rec in rec:
                product_li.append(product_tmpl_rec.get('product_tmpl_id'))
                product = self.env['product.template'].search(
                    [('id', '=', product_tmpl_rec.get('product_tmpl_id'))])
                waring_str = waring_str + "\n" + product.name + \
                    " skipped,linked to group " + product_tmpl_rec.get('name')
            conditional_rec = self.env[
                'product.template.conditional.discount'].sudo().search(
                [('product_tmpl_id', '=', product_li),
                    ('conditional_discount_id', '=', self.id)]).ids
            if len(conditional_rec) == 1:
                conditional_rec = str(conditional_rec[0])
                query = '''
                    delete from product_template_conditional_discount
                    where id = ''' + \
                    conditional_rec + ''';'''
            else:
                conditional_rec = str(tuple(conditional_rec))
                query = '''
                    delete from product_template_conditional_discount
                    where id in ''' + \
                    conditional_rec + ''';'''
            self._cr.execute(query)
            self._cr.commit()
            raise UserError(waring_str)
