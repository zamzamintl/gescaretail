# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Quickly Clear Orderline',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allow to remove orderline quickly',
    'description': """

Allow to remove orderline quickly

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': ['view/templates.xml'],
    'qweb': ['static/src/xml/pos_quickly_clear_orderline.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
