# -*- coding: utf-8 -*-
from odoo import models, api, fields, _
from odoo.tools.misc import formatLang
from odoo.exceptions import UserError


class LabelsSheetReport(models.AbstractModel):
    _name = 'report.o4f_product_labels.labels_sheet'

    @api.model
    def _get_report_values(self, docids, data=None):
        products = []

        if data.get('source_model', '') == 'product.product':
            quantity = int(data.get('quantity', 1))
            product_ids = self.env['product.product'].with_context(
                pricelist=data.get('pricelist_id'),
                quantity=quantity
            ).browse(data.get('ids'))
            product_ids = product_ids.filtered(lambda r: r.barcode)

            if not product_ids:
                raise UserError(
                    _('No barcodes found for current selection!')
                )

            for product in product_ids:
                for i in range(quantity):
                    products.append({
                        'product': product,
                        'price': formatLang(
                            self.env,
                            product.price,
                            monetary=True,
                            currency_obj=self.env.user.company_id.currency_id
                        ),
                        'quantity': quantity
                    })
        elif data.get('source_model', '') == 'stock.picking':
            picking_ids = self.env['stock.picking'].browse(data.get('ids'))
            move_lines = picking_ids.move_lines.filtered(
                lambda r: r.product_id.barcode
            )

            if not move_lines:
                raise UserError(
                    _('No barcodes assigned for current products!')
                )

            for move_line in move_lines:
                quantity = int(move_line.quantity_done)
                product_id = move_line.product_id.with_context(
                    pricelist=data.get('pricelist_id'),
                    quantity=quantity
                )

                for i in range(quantity):
                    products.append({
                        'product': move_line.product_id,
                        'price': formatLang(
                            self.env,
                            product_id.price,
                            monetary=True,
                            currency_obj=self.env.user.company_id.currency_id
                        ),
                        'quantity': quantity
                    })

        report = self.env['ir.actions.report']._get_report_from_name(
            'o4f_product_labels.labels_sheet'
        )
        model = report.model

        return {
            'doc_ids': self.ids,
            'doc_model': model,
            'docs': {
                'sheets': tuple(
                    products[i:i + 18] for i in range(0, len(products), 18)
                )
            }
        }


class PrintProductLabels(models.TransientModel):
    _name = 'print.product.labels'
    _description = 'Create document with product labels'

    quantity = fields.Integer(
        string='Quantity',
        default=1,
        required=True,
        help='Amount of labels by measure'
    )
    pricelist_id = fields.Many2one(
        string='Pricelist',
        comodel_name='product.pricelist',
    )
    show_qty = fields.Boolean(
        string='Show qty',
        default=lambda self: self.env.context.get(
            'active_model',
            'product.product'
        ) == 'product.product'
    )

    @api.multi
    def print_labels(self):
        self.ensure_one()

        if not self.env.context.get('active_ids', False):
            return False

        if self.env.context.get(
                'active_model', 'product.product'
        ) == 'product.product':
            data = dict(
                ids=self.env.context.get('active_ids'),
                quantity=self.quantity,
                pricelist_id=self.pricelist_id.id,
                source_model='product.product'
            )
        else:
            data = dict(
                ids=self.env.context.get('active_ids'),
                pricelist_id=self.pricelist_id.id,
                source_model='stock.picking'
            )

        return self.env.ref(
            'o4f_product_labels.report_labels_sheet'
        ).report_action(
            self,
            data=data,
            config=False
        )
