# See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.osv.expression import OR, AND


class ResPartner(models.Model):
    _inherit = 'res.partner'

    def _get_domain_search_name(self, term):

        name_field, operator, search_name = term

        if name_field not in ('name', 'display_name'):
            return [term]
        if not search_name:
            return [term]
        if operator not in ('=', 'ilike', '=ilike', 'like', '=like'):
            return [term]
#        if ' ' not in search_name:
#            return [term]
        # else

        parts = search_name.split(' ')
        search_fields = (
            'name',
            'display_name',
            'email',
            'city',
            'street',
        )
        return AND(
            [
                OR([(f, operator, part)] for f in search_fields)
                for part in parts
            ],
        )

    def search(self, args, offset=0, limit=None, order=None, count=False):
        new_domain = []
        for term in args:
            if type(term) in [list, tuple] \
                    and term[0] in('name', 'display_name'):
                term = self._get_domain_search_name(term)
                new_domain.extend(term)
            else:
                new_domain.append(term)
        return super(ResPartner, self).search(
            new_domain, offset=offset, limit=limit, order=order, count=count
        )
