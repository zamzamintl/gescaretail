# -*- coding: utf-8 -*-

from odoo import fields, models
from odoo.tools.translate import _
from odoo.exceptions import UserError


def isodd(x):
    return bool(x % 2)


class ProductCategory(models.Model):
    _inherit = 'product.category'

    ean_sequence_id = fields.Many2one('ir.sequence', 'Ean Sequence')


class ProductProduct(models.Model):
    _inherit = 'product.product'

    ean_sequence_id = fields.Many2one('ir.sequence', 'Ean Sequence')

    def _get_ean_next_code(self):
        sequence_obj = self.pool.get('ir.sequence')
        ean = ''
        if self.ean_sequence_id:
            ean = sequence_obj.next_by_id(self.ean_sequence_id)
        elif self.categ_id.ean_sequence_id:
            ean = sequence_obj.next_by_id(self.categ_id.ean_sequence_id)
        elif self.company_id and self.company_id.ean_sequence_id:
            ean = sequence_obj.next_by_id(self.company_id.ean_sequence_id)
        elif self._context.get('sequence_id'):
            ean = sequence_obj.next_by_id(self._context.get('sequence_id'))
        else:
            return None
        if len(ean) > 12:
            raise UserError(
                _("There next sequence is upper than 12 characters. "
                  "This can't work. You will have to redefine the "
                  "sequence or create a new one")
            )
        else:
            ean = (len(ean[0:6]) == 6 and ean[0:6] or ean[0:6].ljust(6, '0')) \
                + ean[6:].rjust(6, '0')
        return ean

    def _get_ean_key(self, code):
        sum = 0
        for i in range(12):
            if isodd(i):
                sum += 3 * int(code[i])
            else:
                sum += int(code[i])
        key = (10 - sum % 10) % 10
        return str(key)

    def _generate_ean13_value(self):
        ean13 = False
        ean = self._get_ean_next_code()
        if not ean:
            return None
        key = self._get_ean_key(ean)
        ean13 = ean + key
        return ean13

    def generate_ean13(self, p=None):
        if self.barcode:
            return False
        ean13 = self._generate_ean13_value()
        if not ean13:
            return False
        self.write({'barcode': ean13})

        return ean13

    def generate_ean13_bulk(self, ids):
        products = self.browse(ids)
        barcodes = []

        for product in products:
            if product.barcode:
                continue
            ean13 = product._generate_ean13_value()
            if not ean13:
                continue

            product.write({'barcode': ean13})
            barcodes.append(ean13)

        return barcodes

    def copy(self, id, default=None):
        if default is None:
            default = {}
        default['ean13'] = False
        return super(ProductProduct, self).copy(id, default=default)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
