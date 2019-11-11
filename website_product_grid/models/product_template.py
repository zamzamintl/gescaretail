from odoo import models, api


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    @api.multi
    def get_product_matrix(self):
        self.ensure_one()

        # TODO Remove unused colors or sizes before creating matrix

        size_ids = []
        size_bar = self.env['product.attribute.value']
        color_ids = []
        color_bar = self.env['product.attribute.value']
        product_matrix = {
            # no color
            0: {
                # no size
                0: None
            }
        }

        if self.model_size_attribute:
            size_ids = self.model_size_attribute.value_ids.ids
        if self.model_color_attribute:
            color_ids = self.model_color_attribute.value_ids.ids

        for product in self.product_variant_ids:
            color_id = 0
            size_id = 0
            for attribute in product.attribute_value_ids:
                if attribute.id in color_ids:
                    color_bar |= attribute
                    color_id = attribute.id
                    continue
                if attribute.id in size_ids:
                    size_bar |= attribute
                    size_id = attribute.id

            if color_id not in product_matrix.keys():
                product_matrix[color_id] = {}

            if size_id not in product_matrix[color_id].keys():
                product_matrix[color_id][size_id] = product

        color_bar = color_bar.sorted()
        size_bar = size_bar.sorted()

        def _get_sizes(_color=None):
            _color_id = color.id if _color else 0
            sizes = []
            for size in size_bar:
                variant = product_matrix[_color_id].get(size.id, 0)
                if not variant:
                    sizes.append(None)
                    continue
                sizes.append({
                    'id': variant.id,
                    'obj': variant,
                })
            return sizes

        matrix = []
        for color in color_bar:
            matrix.append(_get_sizes(color))

        # previous for loop wouldn't be triggered
        if len(color_bar) == 0:
            matrix.append(_get_sizes())

        return {
            'colors': color_bar if len(color_bar) > 0 else None,
            'sizes': size_bar if len(size_bar) > 0 else None,
            'matrix': matrix,
        }
