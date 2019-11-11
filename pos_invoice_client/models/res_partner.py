# See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class ResPartner(models.Model):
    _inherit = 'res.partner'

    pos_invoice_partner = fields.Many2one(comodel_name='res.partner',
                                          compute='_get_invoice_client',
                                          store=True)

    @api.depends('child_ids')
    def _get_invoice_client(self):
        for partner in self:
            invoice_partner_ids = partner.child_ids.filtered(
                lambda r: r.type == 'invoice')
            if invoice_partner_ids:
                partner.pos_invoice_partner = invoice_partner_ids[
                    len(invoice_partner_ids) - 1]

    @api.model
    def create_from_ui(self, partner, invoice_partner):
        if partner.get('image'):
            partner['image'] = partner['image'].split(',')[1]
        if partner.get('name'):
            partner['name'] = partner['name'].upper()
        if invoice_partner.get('name'):
            invoice_partner['name'] = invoice_partner['name'].upper()
        partner_id = partner.pop('id', False)
        invoice_partner_id = invoice_partner.pop('id', False)
        if invoice_partner.get('message_follower_ids'):
            del invoice_partner['message_follower_ids']

        if partner_id:  # Modifying existing partner
            self.browse(partner_id).write(partner)
        else:
            partner['lang'] = self.env.user.lang
            partner_id = self.create(partner).id

        if invoice_partner_id:
            self.browse(int(invoice_partner_id)).write(invoice_partner)
        else:
            if not invoice_partner.get('parent_id'):
                invoice_partner['parent_id'] = partner_id
            self.create(invoice_partner)
        return partner_id

    @api.multi
    def name_get(self):
        res = []
        for partner in self:
            if partner.type == 'invoice':
                name = partner.name or ''
                if self._context.get('show_address_only'):
                    name = partner._display_address(without_company=True)
                if self._context.get('show_address'):
                    name = name + "\n" + partner._display_address(
                        without_company=True)
                name = name.replace('\n\n', '\n')

                if self._context.get('show_email') and partner.email:
                    name = "%s <%s>" % (name, partner.email)
                if self._context.get('html_format'):
                    name = name.replace('\n', '<br/>')
                res.append((partner.id, name))
            else:
                res += super(ResPartner, partner).name_get()
        return res
