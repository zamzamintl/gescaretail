# See LICENSE file for full copyright and licensing details.

{
    'name': "Pos Product List",
    'version': "12.0.0.1.3",
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allows to search a product by alphabetic order',
    'description': """

This module allows Search a product by alphabetic order

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': ['views/templates.xml'],
    'qweb': ['static/src/xml/pos.xml'],
    'installable': True,
    'auto_install': False,
    'application': True
}
