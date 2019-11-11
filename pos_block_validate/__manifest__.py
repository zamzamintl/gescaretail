# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Block Validate',
    'version': '12.0.0.1.0',
    'category': 'Point of Sale',
    'summary': '',
    'description': """
This module hide the validate button until the order is fully paid
""",
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'views/assets.xml',
    ],
    'qweb': [],
    'installable': True,
    'auto_install': False,
    'application': False,
}
