# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.tools.misc import formatLang


class ProductTemplateModelPricelist(models.TransientModel):
    _name = 'product.template.model.pricelist'

    @api.model
    def _get_stock_selection(self):
        res = [
            ('price', _('Show prices')),
            ('stock', _('Show all Available stock'))
        ]
        return res

    price_list = fields.Many2one(
        comodel_name='product.pricelist',
        string='Pricelist',
        required=True
    )
    show_image = fields.Boolean(
        string='Show image'
    )
    show_price_stock = fields.Selection(
        selection=_get_stock_selection,
        string='Show price or stock',
        default='price'
    )
    report_format = fields.Selection(
        selection=[('pdf', 'PDF'), ('xls', 'Spreadsheet')],
        default='pdf'
    )

    def _get_pricelist(self, pricelist_id):
        pricelist = \
            self.env['product.pricelist'].browse(
                [pricelist_id])[0]
        return pricelist['name']

    def _get_currency(self, pricelist_id):
        pricelist = \
            self.env['product.pricelist'].browse(
                [pricelist_id])[0]
        return pricelist['currency_id'].name

    def _get_price(self, pricelist_id, product_id, qty):
        sale_price_digits = self.env['decimal.precision'].precision_get(
            'Product Price'
        )
        pricelist = self.env['product.pricelist'].browse([pricelist_id])[0]

        pricelist_item = list(filter(
            lambda x: x.product_id.id == product_id and x.min_quantity == qty,
            pricelist.item_ids))

        if len(pricelist_item) == 1:
            price = formatLang(self.env, pricelist_item[0].fixed_price,
                               digits=sale_price_digits,
                               currency_obj=pricelist.currency_id)
        else:
            product_tmpl = self.env['product.template'].search(
                [('product_variant_ids', '=', product_id)])

            price = product_tmpl.list_price

            price = formatLang(self.env, price, digits=sale_price_digits,
                               currency_obj=pricelist.currency_id)

        return price

    def _has_location(self, stock_id):
        if stock_id == 'price':
            return False
        else:
            return True

    def _get_location(self, stock_id):
        if stock_id in ['price', 'stock']:
            return 'All locations'
        else:
            loc_id = int(stock_id)
            res = self.env['stock.location'].read([loc_id], [
                'complete_name'])
            return res[0]['complete_name']

    def _get_measurebar_product(self, id):
        sale_price_digits = self.env['decimal.precision'].precision_get(
            'Product Price'
        )
        product_template = self.env['product.template'].browse(id)
        attri_lines = self.env['product.template.attribute.line'].search(
            [('product_tmpl_id', '=', id)],
            order='sequence DESC'
        )
        used_attrs = []
        for product in product_template.product_variant_ids:
            for attr in product.attribute_value_ids:
                used_attrs.append(attr.id)
        used_attrs = list(set(used_attrs))
        attr_bar = []
        attrs = []
        Matrix = []
        for attribute in attri_lines:
            all_vals = self.env['product.attribute.value'].search(
                [('attribute_id', '=', attribute.attribute_id.id)])
            for val in all_vals:
                if val.id in used_attrs:
                    attrs.append({
                        'id': val.id,
                        'name': val.name,
                    })
            attr_bar.append(attrs)
            attrs = []
        # attr_bar = list containing 2 lists of attribute values
        if len(attr_bar) == 1:
            attr_bar.append([0])
        if len(attr_bar) > 0:
            Matrix = [[0 for x in range(len(attr_bar[0]))] for y in
                      range(len(attr_bar[1]))]

            for variant in product_template.product_variant_ids:
                x = ""
                y = ""
                for var_val in variant.attribute_value_ids:

                    for i in range(0, len(attr_bar[0])):
                        if var_val.id == attr_bar[0][i].get('id'):
                            x = i
                    if attr_bar[1] == [0]:
                        y = 0
                    else:
                        for j in range(0, len(attr_bar[1])):
                            if var_val.id == attr_bar[1][j].get('id'):
                                y = j
                    if x != "" and y != "":
                        prod = dict()

                        prod = {
                            'product': variant,
                            'price': self._get_price(
                                self.price_list.id, variant.id, 1),
                        }

                        Matrix[y][x] = prod
        image = False
        if self.show_image:
            if product_template.image_small:
                image = product_template.image_small.decode('utf-8')
        template_price = product_template.with_context(
            quantity=1,
            pricelist=self.price_list.id,
        ).price
        template_price = formatLang(self.env, template_price,
                                    digits=sale_price_digits,
                                    currency_obj=self.price_list.currency_id)
        return {
            'measurebar': {
                'name': product_template.name,
                'id': product_template.id,
                'template_price': template_price,
                'products': Matrix,
                'attributes': attr_bar,
                'image': image,
            }
        }

    def _get_measurebars(self, model_ids):
        measurebars = []

        for id in model_ids:
            measurebars.append(self._get_measurebar_product(id))

        return measurebars

    @api.multi
    def print_report(self):
        if self.report_format == 'xls':
            report = self.env.ref(
                'product_models_pricelist.report_models_pricelists_xlsx')
        else:
            report = self.env.ref(
                'product_models_pricelist.report_models_pricelist')

        return report.report_action(
            self,
            data={
                'ids': self.env.context.get('active_ids', []),
                'pricelist_id': self.price_list,
                'record_id': self.id,
                'show_image': self.show_image
            }
        )
