# -*- coding: utf-8 -*-

from odoo import models, fields, api
import time


class OdooFashionObjectMixin(models.AbstractModel):
    _name = 'odoo.fashion.object.mixin'

    order_count = fields.Float(
        string='Order Quantity',
        compute='_get_total_order_qty'
    )
    o2m_line_object = fields.Many2one(
        comodel_name='ir.model.fields',
        compute='_get_odoo_fashion_object_line'
    )

    def _get_total_order_qty(self):
        # Counts the total ordered/invoiced amount
        raise NotImplementedError('Missing _get_total_order_qty() method')

    @api.model
    def get_default_pricelist_id(self):
        res = self.env['product.pricelist'].search(
            [], limit=1, order='sequence'
        )
        return res.id

    @api.model
    def get_default_warehouse_id(self):
        res = self.env['stock.warehouse'].search(
            [], limit=1, order='name'
        )
        return res.id

    def _get_odoo_fashion_object_line(self):
        model = self.env['ir.model'].search(
            [('model', '=', self._name)], limit=1)
        fields = self.env['ir.model.fields'].search(
            [('ttype', '=', 'one2many'), ('model', '=', model.model)])
        for field in fields:
            relation_model = self.env['ir.model'].search(
                [('model', '=', field.relation)])
            for relation_field in relation_model.field_id:
                if relation_field.name == 'ad_is_model_variant':
                    self.o2m_line_object = field
                    return
        raise NotImplementedError('Missing O4F line mixin')

    @api.model
    def get_odoo4fashion_keys(self, record_id):
        record = self.browse([record_id])
        return {
            'quantity': '',
            'tax_id': '',
            'discount': 'no',
            'common_object_line_name': record.o2m_line_object.relation,
            'model_common_lines_name': record.o2m_line_object.name,
            'model_warehouse_name': '',
            'model_partner_id': 'partner_id',
            'model_pricelist_id': '',
            'model_date_order': '',
            'model_fiscal_position_id': '',
            'model_state': 'state',
            'model_doc_type_name': 'no',
            'model_edit_states': ['draft', 'sent']
        }

    @api.model
    def order_compute(self, doc_id):
        return {}

    def _get_line_fields(self, document, measurebars, line):
        model_fields = self.env['ir.model'].search(
            [('model', '=',
              document.o2m_line_object.relation)])
        measurebars[
            len(measurebars) - 1].update({
                'order_model_id': line.order_model_id,
                'comment': line.order_note
            })
        line_vals = {}
        for field in model_fields.field_id:
            if field.ttype != 'binary':
                if field.ttype == 'many2one':
                    line_vals[field.name] = eval(
                        'line.' + field.name + '.id')
                elif field.ttype == 'many2many' or field.ttype == 'one2many':
                    line_vals[field.name] = eval(
                        'line.' + field.name + '.ids')
                else:
                    line_vals[field.name] = eval(
                        'line.' + field.name)
                if field.name == 'discount':
                    measurebars[len(measurebars) - 1].update({
                        'discount': line.discount,
                    })
        quantity_name = self.get_odoo4fashion_keys(document.id).get(
            'quantity')
        return {
            'measurebars': measurebars,
            'line_vals': line_vals,
            'data': {
                'quantity': line_vals.get(quantity_name) or 0
            }
        }

    @api.model
    def get_model_lines(self, record_id):
        user_id = self.env['res.users'].browse([self._uid])
        measurebars = []
        if record_id is None:
            return False
        document = self.browse([record_id])

        model_lines = eval("""self.""" + document.o2m_line_object.name +
                           """.search([('order_model_id', '!=', 0),
                           ('order_model_id' ,'!=', False),(document.
                           o2m_line_object.relation_field, '=', record_id)],
                            order='id asc')""")

        seen = set()
        bar_ids = [x.order_model_id for x in
                   model_lines.sorted(key=lambda r: r.id) if
                   not (x.order_model_id in seen or seen.add(
                       x.order_model_id))]
        for bar_id in range(0, len(bar_ids)):
            product_tmpl_id = model_lines.filtered(
                lambda r: r.order_model_id == bar_ids[bar_id]).mapped(
                'product_id.product_tmpl_id')
            attri_lines = self.env['product.template.attribute.line'].search(
                [('product_tmpl_id', '=', product_tmpl_id.id)],
                order='sequence')
            used_attrs = []
            for product in product_tmpl_id.with_context(active_test=False) \
                    .product_variant_ids:
                for attr in product.attribute_value_ids:
                    used_attrs.append(attr.id)
            used_attrs = list(set(used_attrs))
            attr_bar = []
            attrs = []

            for attribute in attri_lines:
                all_vals = self.env['product.attribute.value'].search(
                    [('attribute_id', '=', attribute.attribute_id.id)])
                for val in all_vals:
                    if val.id in used_attrs:
                        attrs.append({
                            'id': val.id,
                            'name': val.with_context(
                                {'lang': user_id.lang}).name,
                        })
                attr_bar.append(attrs)
                attrs = []
                # attr_bar = list containing 2 lists of attribute values
            if len(attr_bar) == 1:
                attr_bar.append([0])
            if len(attr_bar) == 0:
                attr_bar.append([0])
                attr_bar.append([0])
            Matrix = [[0 for x in range(len(attr_bar[0]))] for y in
                      range(len(attr_bar[1]))]
            image = ""

            if product_tmpl_id.image_small:
                image = product_tmpl_id.image_small
            measurebars.append({
                'name': product_tmpl_id.with_context(
                    {'lang': user_id.lang}).name,
                'id': product_tmpl_id.id,
                'comment': '',
                'products': Matrix,
                'attributes': attr_bar,
                'total_quantity': 0,
                'total_price': 0.0,
                'discount': 0,
                'image': image,
                'taxes': ' ,'.join(
                    map(lambda x: x.name, product_tmpl_id.taxes_id)),
                'bar_id': bar_ids[bar_id],
            })

            bar_lines = eval("""self.""" + document.o2m_line_object.name +
                             """.search([
                             ('order_model_id' ,'=', """ + str(bar_ids[bar_id])
                             + """),(document.o2m_line_object.relation_field,
                              '=', record_id)],order='id asc')""")
            for line in bar_lines:

                x = False
                y = False
                if line.product_id.attribute_value_ids:
                    for var_val in line.product_id.attribute_value_ids:

                        for i in range(0, len(attr_bar[0])):
                            if var_val.id == attr_bar[0][i].get('id'):
                                x = i
                        if attr_bar[1] == [0]:
                            y = 0
                        else:
                            for j in range(0, len(attr_bar[1])):
                                if var_val.id == attr_bar[1][j].get(
                                        'id'):
                                    y = j

                        if x is not False and y is not False:

                            quants = []
                            if 'warehouse_id' in self._fields:
                                if document.warehouse_id:
                                    location = document.warehouse_id.\
                                        lot_stock_id
                                    quants = self.env['stock.quant'].search([
                                        ('location_id', '=', location.id),
                                        ('product_id', '=', line.product_id.id)
                                    ])
                                else:
                                    quants = self.env['stock.quant'].search([
                                        ('product_id', '=', line.product_id.id)
                                    ])
                            quant_product_id = sum(q.quantity for q in quants)

                            line_fields = self._get_line_fields(document,
                                                                measurebars,
                                                                line)
                            measurebars = line_fields.get('measurebars')
                            Matrix[y][x] = {
                                'line': line_fields.get('line_vals'),
                                'data': {
                                    'quantity': line_fields.get(
                                        'data').get('quantity'),
                                    'stock': quant_product_id
                                }

                            }
                else:
                    quants = []
                    if 'warehouse_id' in self._fields:
                        if document.warehouse_id:
                            location = document.warehouse_id.lot_stock_id
                            quants = self.env['stock.quant'].search([
                                ('location_id', '=', location.id),
                                ('product_id', '=', line.product_id.id)
                            ])
                        else:
                            quants = self.env['stock.quant'].search([
                                ('product_id', '=', line.product_id.id)
                            ])
                    quant_product_id = sum(q.quantity for q in quants)

                    line_fields = self._get_line_fields(document,
                                                        measurebars,
                                                        line)
                    measurebars = line_fields.get('measurebars')
                    Matrix[0][0] = {
                        'line': line_fields.get('line_vals'),
                        'data': {
                            'quantity': line_fields.get(
                                'data').get('quantity'),
                            'stock': quant_product_id
                        }

                    }
        for bar in measurebars:
            for line in bar.get('products'):
                for prod in line:
                    if prod != 0 and prod is not None:
                        total_price = (prod.get('line').get('price_unit') *
                                       (1 - (prod.get('line').get('discount')
                                             or 0.0) / 100)) \
                            * prod.get('data').get('quantity')
                        bar['total_quantity'] += prod.get('data').get(
                            'quantity')
                        bar['total_price'] += total_price
        measurebars.reverse()
        return measurebars

    @api.model
    def get_model_lines_report(self):
        record_id = self.env.context.get('id', self.id)
        measurebars = self.get_model_lines(record_id)
        document = self.browse([record_id])
        lines = []
        for order_line in eval("""self.""" + document.o2m_line_object.name +
                               """.search([['ad_is_model_variant', '=', True],
                                [document.o2m_line_object.relation_field,
                                 '=', record_id]], order='id')"""):
            if len(lines) > 0:
                hasid = False
                for line in lines:
                    if order_line.order_model_id == line["order_model_id"]:
                        line["variants"].append(order_line)
                        hasid = True
                if not hasid:
                    lines.append({
                        "comment": order_line.order_note,
                        "order_model_id": order_line.order_model_id,
                        "product": order_line,
                        "variants": [],
                        "variant_lines": []

                    })
                    lines[len(lines) - 1]["variants"].append(order_line)
            else:
                lines.append({
                    "comment": order_line.order_note,
                    "order_model_id": order_line.order_model_id,
                    "product": order_line,
                    "variants": [],
                    "variant_lines": []

                })
                lines[0]["variants"].append(order_line)

        return {
            "lines": lines,
            "measurebars": measurebars
        }

    @api.model
    def new_model_defaults(self, partner_id, pricelist_id, date_order,
                           fiscal_position, state, template_id,
                           warehouse_id=1, **args):
        partner_id = self.env['res.partner'].browse([partner_id])
        user_id = self.env['res.users'].browse([self._uid])
        if pricelist_id or pricelist_id is not None:
            pricelist_id = self.env['product.pricelist'].browse([pricelist_id])
        else:
            pricelist_id = self.env['product.pricelist']
        if fiscal_position:
            fiscal_position = self.env['account.fiscal.position'].browse(
                [fiscal_position])
        else:
            fiscal_position = self.env['account.fiscal.position']
        product_template = self.env['product.template'].browse([template_id])

        attri_lines = self.env['product.template.attribute.line'].search(
            [('product_tmpl_id', '=', template_id)],
            order='sequence')
        attr_bar = []
        attrs = []
        discount = 0
        used_attrs = []
        for product in product_template.product_variant_ids:
            for attr in product.attribute_value_ids:
                used_attrs.append(attr.id)

        used_attrs = list(set(used_attrs))

        for attribute in attri_lines:
            all_vals = self.env['product.attribute.value'].search(
                [('attribute_id', '=', attribute.attribute_id.id)])
            for val in all_vals:
                if val.id in used_attrs:
                    attrs.append({
                        'id': val.id,
                        'name': val.with_context(
                            {'lang': user_id.lang}).name,
                    })
            attr_bar.append(attrs)
            attrs = []
        if len(attr_bar) == 1:
            attr_bar.append([0])

        if len(attr_bar) > 1:
            Matrix = [[0 for x in range(len(attr_bar[0]))] for y in
                      range(len(attr_bar[1]))]

            for variant in product_template.product_variant_ids:
                x = False
                y = False
                for var_val in variant.attribute_value_ids:

                    for i in range(0, len(attr_bar[0])):
                        if var_val.id == attr_bar[0][i].get('id'):
                            x = i

                    if attr_bar[1] == [0]:
                        y = 0
                    else:
                        for j in range(0, len(attr_bar[1])):
                            if var_val.id == attr_bar[1][j].get(
                                    'id'):
                                y = j
                    if x is not False and y is not False:
                        res = self.create_new_line(partner_id, pricelist_id,
                                                   variant.id, 0.0, date_order,
                                                   fiscal_position, state,
                                                   **args)
                        Matrix[y][x] = {'line': {}, 'data': {
                            'quantity': res['value'].get(
                                self.get_odoo4fashion_keys(
                                    record_id=self.id).get('quantity'))}}
                        Matrix[y][x]['line'] = res['value']
                        if warehouse_id:
                            location = \
                                self.env['stock.warehouse'].browse(
                                    [warehouse_id])[
                                    0].lot_stock_id
                            quant = self.env['stock.quant'].search(
                                [('location_id', '=', location.id),
                                 ('product_id', '=', variant.id)])
                        else:
                            quant = self.env['stock.quant'].search(
                                [('product_id', '=', variant.id)])
                        quant_total = 0
                        for q in quant:
                            quant_total += q.quantity
                        Matrix[y][x]['data']['stock'] = quant_total
        else:
            attr_bar.append([0])
            attr_bar.append([0])
            Matrix = [[0 for x in range(len(attr_bar[0]))] for y in
                      range(len(attr_bar[1]))]
            res = self.create_new_line(partner_id, pricelist_id,
                                       product_template.product_variant_id.id,
                                       0.0, date_order,
                                       fiscal_position, state,
                                       **args)
            Matrix[0][0] = {'line': {}, 'data': {
                'quantity': res['value'].get(
                    self.get_odoo4fashion_keys(
                        record_id=self.id).get('quantity'))}}
            Matrix[0][0]['line'] = res['value']

        image = ""

        if product_template.image_small:
            image = product_template.image_small
        return {
            'name': product_template.with_context(
                {'lang': user_id.lang}).name,
            'id': product_template.id,
            'comment': '',
            'products': Matrix,
            'attributes': attr_bar,
            'total_quantity': 0,
            'total_price': 0.0,
            'discount': discount,
            'image': image,
            'taxes': ' ,'.join(
                map(lambda x: x.name, product_template.taxes_id)),
            'order_model_id': 0
        }

    @api.model
    def create_new_line(self, partner_id, pricelist_id, product_id, qty,
                        date_order, fiscal_position_id, state, **args):
        return {'value': {}}


class OdooFashionObjectLineMixin(models.AbstractModel):
    _name = 'odoo.fashion.object.line.mixin'

    def _get_order_model_id(self):
        return int(time.time())

    ad_is_model_variant = fields.Boolean(
        string='Is Model Variant',
        default=False
    )
    order_note = fields.Char(
        string='Order Note'
    )
    order_model_id = fields.Integer(
        string='Model ID Identifier',
        default=_get_order_model_id
    )
