# See LICENSE file for full copyright and licensing details.

import logging
import itertools

from odoo import api, models, _
from odoo.exceptions import ValidationError, UserError
_logger = logging.getLogger('base.partner.merge')


class MergePartnerAutomatic(models.TransientModel):

    _inherit = 'base.partner.merge.automatic.wizard'

    @api.model
    def _update_values(self, src_partners, dst_partner):

        _logger.debug(
            '_update_values for dst_partner: %s for src_partners: %r',
            dst_partner.id, src_partners.ids)

        model_fields = dst_partner.fields_get().keys()

        def write_serializer(item):
            if isinstance(item, models.BaseModel):
                return item.id
            else:
                return item
        # get all fields that are not computed or x2many
        values = dict()
        for column in model_fields:
            field = dst_partner._fields[column]
            if field.type not in (
                    'many2many', 'one2many') and field.compute is None:
                if field.name == 'loyalty_amounts':
                    value = 0
                    for item in itertools.chain(src_partners, [dst_partner]):
                        if item[column]:
                            value = value + item[column]
                    values[column] = write_serializer(value)
                else:
                    for item in itertools.chain(src_partners, [dst_partner]):
                        if item[column]:
                            values[column] = write_serializer(item[column])
        # remove fields that can not be updated (id and parent_id)
        values.pop('id', None)
        parent_id = values.pop('parent_id', None)
        dst_partner.write(values)
        # try to update the parent_id
        if parent_id and parent_id != dst_partner.id:
            try:
                dst_partner.write({'parent_id': parent_id})
            except ValidationError:
                _logger.info(
                    'Skip recursive partner hierarchies for parent_id %s of \
                    partner: %s', parent_id, dst_partner.id)

    def _merge(self, partner_ids, dst_partner=None):
        partner = self.env['res.partner']
        partner_ids = partner.browse(partner_ids).exists()
        if len(partner_ids) < 2:
            return

        if len(partner_ids) > 3:
            raise UserError(
                _("""For safety reasons, you cannot merge more than 3
                    contacts together. You can re-open the wizard several
                    times if needed.
                """))

        # check if the list of partners to merge contains child/parent
        # relation
        child_ids = self.env['res.partner']
        for partner_id in partner_ids:
            child_ids |= partner.search(
                [('id', 'child_of', [partner_id.id])]) - partner_id
        if partner_ids & child_ids:
            raise UserError(
                _("You cannot merge a contact with one of his parent."))

        # remove dst_partner from partners to merge
        if dst_partner and dst_partner in partner_ids:
            src_partners = partner_ids - dst_partner
        else:
            ordered_partners = self._get_ordered_partner(partner_ids.ids)
            dst_partner = ordered_partners[-1]
            src_partners = ordered_partners[:-1]
        _logger.info("dst_partner: %s", dst_partner.id)
        # call sub methods to do the merge
        self._update_foreign_keys(src_partners, dst_partner)
        self._update_reference_fields(src_partners, dst_partner)
        self._update_values(src_partners, dst_partner)

        _logger.info('(uid = %s) merged the partners %r with %s',
                     self._uid, src_partners.ids, dst_partner.id)
        dst_partner.message_post(
            body='%s %s' % (_("Merged with the following partners:"),
                            ", ".join('%s <%s> (ID %s)' % (
                                p.name, p.email or 'n/a', p.id) for p in
                            src_partners)))

        # delete source partner, since they are merged
        src_partners.unlink()
