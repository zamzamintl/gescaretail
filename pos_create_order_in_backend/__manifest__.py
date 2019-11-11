# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Create Order In Backend',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 7,
    'summary': 'Create Order in backend',
    "description": """
This module allow to create Order in backend.
    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': ['views/pos_create_order_in_backend_view.xml'],
    'installable': True,
    'auto_install': False,
    'application': True,
}
