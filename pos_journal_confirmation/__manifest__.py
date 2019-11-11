# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Journal Confirmation',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allow to Confirmation of Journal',
    'description': """

This module allow to Confirmation of Journal.

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['pos_addons', 'point_of_sale'],
    'data': [
        'views/template.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': True,
}
