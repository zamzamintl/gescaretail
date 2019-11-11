# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Cash Drawer',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allow cashier to open cash drawer',
    'description': """

    Allow cashier to open cash drawer

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': ['views/template.xml'],
    'qweb': ['static/src/xml/pos_cashdrawer.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
