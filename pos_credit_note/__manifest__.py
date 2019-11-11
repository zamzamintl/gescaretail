# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Credit Note',
    'version': '12.0.0.1.1',
    'category': 'Point Of Sale',
    'sequence': 7,
    'summary': 'Credit note feature in POS',
    'description': """

   Credit note feature in POS

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],  # ['pos_rma', 'pos_credit_voucher'],
    'data': [
        'data/pos_credit_note.xml',
        'views/pos_credit_note_view.xml',
        'views/templates.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': True,
}
