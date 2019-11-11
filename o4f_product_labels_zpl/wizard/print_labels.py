# -*- coding: utf-8 -*-
from odoo import fields, models, api


class PrintProductLabels(models.TransientModel):
    _inherit = 'print.product.labels'

    label_type = fields.Selection(
        selection=[('zpl', 'ZPL'), ('normal', 'Normal')],
        default='normal',
        string='Type',
    )
    printer_id = fields.Many2one(
        comodel_name='printing.printer',
        string='Printer',
    )

    @api.multi
    def print_labels(self):
        self.ensure_one()
        # if normal then use the normal label
        if self.label_type == 'normal':
            return super(PrintProductLabels, self).print_labels()

        model = self.env.context.get('active_model')
        model_ids = self.env.context.get('active_ids')

        records = self.env[model].browse(model_ids)

        label = self.env.ref('o4f_product_labels_zpl.o4f_product_label')
        if model == 'stock.picking':
            products = []
            # get for the picking all delivered products and qty's
            products.extend([
                (p.product_id, p.quantity_done)
                for p in records.filtered(
                    lambda r: r.state == 'done'
                )
            ])
        elif model == 'product.product':
            products = [(p, self.quantity) for p in records]

        # get the label
        labels = []
        for product, product_qty in products:
            label_count = int(round(product_qty, 0))
            # get the product with correct data
            if self.pricelist_id:
                product = product.with_context(
                    pricelist=self.pricelist_id.id,
                    quantity=1
                )
            # print the label
            labels.append(label._generate_zpl2_data(
                product, page_count=label_count)
            )

        self.printer_id.print_document(None, '\n'.join(labels), 'raw')
