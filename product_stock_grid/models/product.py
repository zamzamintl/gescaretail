# -*- coding: utf-8 -*-
import logging

from odoo import models, fields, api, _

_logger = logging.getLogger(__name__)


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    product_stock_grid = fields.Text(
        string='Stock grid',
        compute="_get_grid_stock_locations",
    )

    @api.multi
    def action_product_template_stock_grid_action(self):
        action = self.env.ref(
            'product_stock_grid.product_template_stock_grid_action').read()[0]
        action.update({'res_id': self.id})
        return action

    @api.model
    def retrieve_data_stock_grid(self, product_tmpl_ids):
        '''
        Type dict to return
        {'colors': colors,
                'locations': locations.mapped('princess_location_name'),
                measures': sizes,
                'red': {
                    'rows': {
                        'loc 1': {'M': 1, 'S': 2, 'L': 3, 'total': 6},
                        'loc 2': {'M': 1, 'S': 2, 'L': 3, 'total': 6},
                    },
                    'totals': {'M': 2, 'S': 4, 'L': 6, 'total': 12}
                },
                'green': {
                    'rows': {
                        'loc 1': {'M': 1, 'S': 2, 'L': 3, 'total': 6},
                        'loc 2': {'M': 2, 'S': 3, 'L': 4, 'total': 9},
                    },
                    'totals': {'M': 3, 'S': 5, 'L': 7, 'total': 15}
                }
                }
        :param product_tmpl_ids:
        :return:
        '''
        # Get all locations as (obj, name)
        locations = [(x, x.name) for x in
                     self.env['stock.location'].search(
                         [('usage', '=', 'internal')], order='sequence asc')]

        # build a dictionary all products per size and per color
        '''
        Next will build this kind of dict
        {'color 1':
            {'size 1':prods,
             'size2':prods
             },
        'color 1':
            {'size 1':prods,
             'size2':prods
             }
        }
        '''
        prod_obj = self.env['product.product']
        template = self.browse(product_tmpl_ids)
        template.ensure_one()
        color_names = {
            color_id: '%s' % (color_id.name or '')
            for color_id in
            template.product_variant_ids.mapped('color_attribute_id')
        }
        variants = [
            (
                prd,
                prd.size_attribute_id or False,
                prd.color_attribute_id or False,
            )
            for prd in template.product_variant_ids
        ]
        # get the variant color ids
        color_ids = list(set([x[2] for x in variants if x[2]]))
        # get the variant size ids
        size_ids = list(set([x[1] for x in variants]))
        # to be sure we get them in the right order we do a search
        # by those ids
        if size_ids:
            sizes = self.env['product.attribute.value'].search(
                [('id', 'in', [x.id for x in size_ids])]).mapped('name')
        else:
            sizes = ['']
        if color_ids:
            colors = self.env['product.attribute.value'].search(
                [('id', 'in', [x.id for x in color_ids])]
            ).mapped(
                lambda c: color_names.get(c or '')
            )
        else:
            colors = [color_names.get('')]
        # build default dict
        prod_per_size_color = {
            c: {
                s: prod_obj
                for s in sizes
            }
            for c in colors
        }
        # fill up the dict
        for prd, size_id, color_id in variants:
            prod_per_size_color[
                color_names.get(color_id or '')
            ][size_id.name] += prd

        # if no colors found for this product at least add a empty one
        colors = len(colors) != 0 and colors or ['']
        # if no sizes found for this product at least add a empty one
        sizes = len(sizes) != 0 and sizes or ['']

        # calculate stocks per location
        data = {
            'colors': colors,
            # list of location names
            'locations': [x[1] for x in locations],
            'measures': sizes,
        }
        for color in colors:
            data.setdefault(
                color,
                {
                    'rows': {
                        loc_name: {
                            s: 0
                            for s in sizes + ['total']
                        }
                        for loc, loc_name in locations
                    },
                    'totals': {
                        s: 0
                        for s in sizes + ['total']
                    }
                }
            )
            # only take the sizes which have product.products attached
            for size in sizes:
                for loc, loc_name in locations:
                    # calculate qty for all products
                    for prod in prod_per_size_color.get(color).get(size):
                        qty = int(
                            prod.with_context(location=loc.id).qty_available)
                        data[color]['rows'][loc_name][size] += qty
                        data[color]['rows'][loc_name]['total'] += qty
                        data[color]['totals'][size] += qty
                        data[color]['totals']['total'] += qty

        return data

    def _get_grid_stock_locations(self):
        for record in self:
            try:
                html = self.env['ir.actions.report']._get_report_from_name(
                    'product_stock_grid.report_stock_grid_doc') \
                    .render_qweb_html(
                    record
                )[0].decode("utf-8")
            except:
                _logger.exception(
                    'Failed to render stock grid for product id %s' % record.id
                )
                html = _("<p>Failed to retrieve stock info</p>")

            record.product_stock_grid = html
        return True

    @api.multi
    def action_view_stock_moves(self):
        res = super(ProductTemplate, self).action_view_stock_moves()
        res['context']['search_default_group_color_attribute'] = 1
        res['context']['search_default_group_size_attribute'] = 1
        return res
