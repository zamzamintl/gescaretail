# -*- coding: utf-8 -*-
from odoo import models, fields, api
import odoo.addons.decimal_precision as dp


class AccountInvoiceLine(models.Model):
    _name = 'account.invoice.line'
    _inherit = ['account.invoice.line', 'odoo.fashion.object.line.mixin']

    @api.model
    def create(self, vals):
        if 'purchase_line_id' in vals.keys():
            line = self.env['purchase.order.line'].browse(
                [vals['purchase_line_id']])
            vals['order_model_id'] = line.order_model_id
        res = super(AccountInvoiceLine, self).create(vals)
        return res

    @api.model
    def move_line_get(self, invoice_id):
        res = super(AccountInvoiceLine, self).move_line_get(invoice_id)

        result = []
        for item in res:
            if 'quantity' in item and item['quantity'] == 0:
                continue
            result.append(item)

        return result


class AccountInvoice(models.Model):
    _name = 'account.invoice'
    _inherit = ['account.invoice', 'odoo.fashion.object.mixin']

    ad_ro_amount_untaxed = fields.Float(
        string='Amount untaxed',
        compute='_duplicate_amount',
        digits=dp.get_precision('Account')
    )
    ad_ro_amount_tax = fields.Float(
        string='Amount tax',
        compute='_duplicate_amount',
        digits=dp.get_precision('Account')
    )
    ad_ro_amount_total = fields.Float(
        string='Amount total',
        compute='_duplicate_amount',
        digits=dp.get_precision('Account')
    )
    date_invoice = fields.Date(
        string='Invoice Date',
        readonly=True, states={'draft': [('readonly', False)]},
        index=True,
        help="Keep empty to use the current date",
        copy=False,
        default=fields.Date.context_today
    )

    @api.model
    def order_compute(self, invoice_id):
        invoice = self.env['account.invoice'].browse([invoice_id])
        invoice._compute_amount()
        invoice._compute_residual()

    @api.multi
    def invoice_validate(self):
        for invoice in self:
            for line in invoice.invoice_line_ids:
                if line.quantity == 0:
                    line.unlink()

        res = super(AccountInvoice, self).invoice_validate()
        return res

    @api.depends('amount_untaxed', 'amount_tax', 'amount_total')
    def _get_total_order_qty(self):
        for invoice in self:
            invoice.order_count = sum(
                invoice.mapped('invoice_line_ids.quantity')
            )

    @api.depends('amount_untaxed', 'amount_tax', 'amount_total')
    def _duplicate_amount(self):
        self[0].ensure_one()
        self[0].ad_ro_amount_untaxed = self[0].amount_untaxed
        self[0].ad_ro_amount_tax = self[0].amount_tax
        self[0].ad_ro_amount_total = self[0].amount_total

    @api.model
    def get_odoo4fashion_keys(self, record_id):
        res = super(AccountInvoice, self).get_odoo4fashion_keys(record_id)
        res.update({
            'quantity': 'quantity',
            'tax_id': 'invoice_line_tax_ids',
            'discount': 'discount',
            'model_warehouse_name': 'no',
            'model_partner_id': 'partner_id',
            'model_pricelist_id': 'no',
            'model_date_order': 'date_invoice',
            'model_fiscal_position_id': 'fiscal_position_id',
            'model_state': 'state',
            'model_doc_type_name': 'type',
            'model_edit_states': ['draft']
        })
        return res

    def _prepare_invoice_line_from_po_line(self, line):
        res = super(AccountInvoice, self)._prepare_invoice_line_from_po_line(
            line)
        res['ad_is_model_variant'] = line.ad_is_model_variant
        res['order_note'] = line.order_note
        res['order_model_id'] = line.order_model_id
        return res

    @api.model
    def get_model_lines_report(self):
        res = super(AccountInvoice, self).get_model_lines_report()
        variantlines = []

        for line in res.get('lines'):
            arr_variants = line.get("variants")
            for variant in arr_variants:
                if len(variantlines) > 0:
                    hasid = False
                    for l in variantlines:
                        if l['price_unit'] == variant.price_unit:
                            l['quantity'] = l['quantity'] + variant.quantity
                            l['price_subtotal'] += variant.price_subtotal
                            hasid = True
                    if not hasid:
                        variantlines.append({
                            'product_name': variant.product_id.
                            product_tmpl_id.display_name,
                            'quantity': variant.quantity,
                            'price_unit': variant.price_unit,
                            'tax_id': variant.invoice_line_tax_ids,
                            'price_subtotal': variant.price_subtotal,
                            'discount': variant.discount
                        })
                else:
                    variantlines.append({
                        'product_name': variant.product_id.
                        product_tmpl_id.display_name,
                        'quantity': variant.quantity,
                        'price_unit': variant.price_unit,
                        'tax_id': variant.invoice_line_tax_ids,
                        'price_subtotal': variant.price_subtotal,
                        'discount': variant.discount
                    })
            line["variant_lines"].append(variantlines)
            variantlines = []

        return res

    @api.model
    def create_new_line(self, partner_id, pricelist_id, product_id, qty,
                        date_order, fiscal_position_id, state, **args):
        fiscal_position = fiscal_position_id
        product = self.env['product.product'].browse(product_id)
        company = self.env['res.company'].search([])[0]
        vals = {}
        vals['product_id'] = product_id
        vals['quantity'] = qty
        vals['ad_is_model_variant'] = True
        vals['order_model_id'] = 0

        product = product.with_context(
            lang=partner_id.lang,
            partner=partner_id.id,
            quantity=qty,
            date=date_order,
            uom=product.uom_id.id
        )

        name = product.name_get()[0][1]
        vals['name'] = name

        fpos = fiscal_position or partner_id.property_account_position_id
        if fpos:
            tax_id = fpos.map_tax(product.taxes_id)
        else:
            tax_id = product.taxes_id if product.taxes_id else False

        vals['price_unit'] = self.env['account.tax']._fix_tax_included_price(
            product.lst_price, product.taxes_id,
            tax_id)
        vals['price_subtotal'] = qty * vals['price_unit']

        if tax_id is not False:
            vals['invoice_line_tax_ids'] = tax_id.ids
        account = self.env['account.invoice.line'].get_invoice_line_account(
            args.get('type'), product, fpos, company)
        if account:
            vals['account_id'] = account.id
        return {'value': vals}

    def _on_invoice_line_ids_widget_change(self):
        # Calling onchanges manually because not being triggered by widget
        # Issue @api.onchange('invoice_line_ids') functions are not triggered
        self._onchange_invoice_line_ids()
        self._onchange_cash_rounding()

    @api.multi
    def write(self, vals):
        res = super(AccountInvoice, self).write(vals)

        if vals.get('invoice_line_ids', False) \
                and not vals.get('tax_line_ids', False):
            self._on_invoice_line_ids_widget_change()

        return res
