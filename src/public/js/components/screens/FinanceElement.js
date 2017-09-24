import { Map as ImmutableMap, List } from 'immutable';

import React from 'react';
import { connect } from 'react-redux';

import page from 'page';

import { max } from 'd3-array';

import {m52ToAggregated, hierarchicalAggregated, hierarchicalM52}  from '../../../../shared/js/finance/memoized';
import {default as visit, flattenTree} from '../../../../shared/js/finance/visitHierarchical.js';

import { EXPENDITURES, REVENUE, DF, DI } from '../../../../shared/js/finance/constants';

const rubriqueIdToLabel = require('../../../../shared/js/finance/m52FonctionLabels.json');

import LegendList from '../../../../shared/js/components/LegendList';
import StackChart from '../../../../shared/js/components/StackChart';
import {makeAmountString, default as MoneyAmount} from '../../../../shared/js/components/MoneyAmount';

import PageTitle from '../../../../shared/js/components/gironde.fr/PageTitle';
import SecundaryTitle from '../../../../shared/js/components/gironde.fr/SecundaryTitle';
import DownloadSection from '../../../../shared/js/components/gironde.fr/DownloadSection';
import PrimaryCallToAction from '../../../../shared/js/components/gironde.fr/PrimaryCallToAction';

import {CHANGE_EXPLORATION_YEAR} from '../../constants/actions';

import colorClassById from '../../colorClassById';
import makeHTMLSummary from '../../makeHTMLSummary';

import FinanceElementPie from '../FinanceElementPie';
import RollingNumber from '../RollingNumber';

/*
    In this component, there are several usages of dangerouslySetInnerHTML.

    In the context of the public dataviz project, the strings being used are HTML generated by 
    a markdown parser+renderer. This part is considered trusted enough.

    The content being passed to the markdown parser is created and reviewed by the project team and likely
    by the communication team at the Département de la Gironde. So this content is very very unlikely to ever
    contain anything that could cause any harm.

    For these reasons, the usages of dangerouslySetInnerHTML are fine.
*/



/*

interface FinanceElementProps{
    contentId: string,
    amount, // amount of this element
    aboveTotal, // amount of the element in the above category
    topTotal // amount of total expenditures or revenue
    texts: FinanceElementTextsRecord,

    // the partition will be displayed in the order it's passed. Sort beforehand if necessary
    partition: Array<{
        contentId: string,
        partAmount: number,
        texts: FinanceElementTextsRecord,
        url: stringMarkdown
    }>
}

*/


const PARTITION_TOTAL_HEIGHT = 42;
const MIN_STRING_HEIGHT = 2;

export function FinanceElement({contentId, RDFI, amountByYear, parent, top, texts, partitionByYear, year, m52Rows, changeExplorationYear}) {
    const label = texts && texts.label || '';
    const atemporalText = texts && texts.atemporal;
    const temporalText = texts && texts.temporal;

    const amount = amountByYear.get(year);

    const years = partitionByYear.keySeq().toJS();

    // sort all partitions part according to the order of the last year partition
    let lastYearPartition = partitionByYear.get(max(years))
    lastYearPartition = lastYearPartition && lastYearPartition.sort((p1, p2) => p2.partAmount - p1.partAmount);
    const partitionIdsInOrder = lastYearPartition && lastYearPartition.map(p => p.contentId) || [];

    // reorder all partitions so they adhere to partitionIdsInOrder
    partitionByYear = partitionByYear.map(partition => {
        // indexOf inside a .map leads to O(n^2), but lists are 10 elements long max, so it's ok
        return partition && partition.sort((p1, p2) => partitionIdsInOrder.indexOf(p1.contentId) - partitionIdsInOrder.indexOf(p2.contentId))
    })

    let thisYearPartition = partitionByYear.get(year);

    let barchartPartitionByYear = partitionByYear;
    if(contentId === 'DF'){
        // For DF, for the split thing at the end, the whole partition is needed. 
        // However, DF-1 === DF-2, so for the barchart, we only want one of them with the label "solidarité"
        barchartPartitionByYear = barchartPartitionByYear.map(partition => {
            partition = partition.remove(partition.findIndex(p => p.contentId === 'DF-1'))

            const df2 = partition.find(p => p.contentId === 'DF-2');

            return partition.set(partition.findIndex(p => p.contentId === 'DF-2'), {
                contentId: df2.contentId,
                partAmount: df2.partAmount,
                texts: df2.texts && df2.texts.set('label', 'Actions sociales par publics'),
                url: df2.url
            });
        })

        // temporarily don't display DF-1
        thisYearPartition = thisYearPartition && thisYearPartition.remove(
            thisYearPartition.findIndex(p => p.contentId === 'DF-1')
        )
        
    }

    const RDFIText = RDFI === DF ?
        'Dépense de fonctionnement' : 
        RDFI === DI ?
            `Dépense d'investissement`:
            '';

    const isLeaf = !(thisYearPartition && thisYearPartition.size >= 2);

    const parentColorClass = parent ? [colorClassById.get(parent.id), 'darker'].join(' ') : undefined;
    const elementColorClass = top ? colorClassById.get(contentId) : undefined;

    return React.createElement('article', {className: 'finance-element'},
        React.createElement(PageTitle, {text: RDFI ? 
            `${RDFIText} - ${label} en ${year}` :
            `${label} en ${year}`}), 
        React.createElement('section', {}, 
            React.createElement('div', {className: 'top-infos'},
                parent || top ? React.createElement('div', {},
                    React.createElement(FinanceElementPie, {
                        parent,
                        colorClass1: parentColorClass,
                        colorClass2: elementColorClass,
                        backgroundColorClass: 'discrete-grey',
                        radius: 180,
                        proportion1: parent ? parent.amount/top.amount : undefined,
                        proportion2: top ? amount/top.amount : undefined
                    }),
                    React.createElement(LegendList, {items: [
                        {
                            text: label,
                            colorClassName: elementColorClass
                        },
                        parent ? {
                            url: parent.url,
                            text: `Autres ${parent.label}`,
                            colorClassName: parentColorClass
                        } : undefined,
                        top ? {
                            url: top.url,
                            text: `Autres ${top.label}`,
                            colorClassName: 'discrete-grey'
                        } : undefined,
                    ].filter(e => e)})
                ) : undefined,
                React.createElement('div', {},
                    React.createElement('h2', {}, React.createElement(RollingNumber, {amount})),
                    atemporalText ? React.createElement('div', {className: 'atemporal', dangerouslySetInnerHTML: {__html: atemporalText}}) : undefined
                )
            )
        ),
        
        React.createElement('section', {},
            React.createElement(SecundaryTitle, {text: 'Évolution sur ces dernières années'}),
            React.createElement(StackChart, {
                xs: years,
                ysByX: barchartPartitionByYear.map(partition => partition.map(part => part.partAmount)),
                selectedX: year,
                onSelectedXAxisItem: changeExplorationYear,
                onBrickClicked: !isLeaf ? (year, id) => {
                    const url = barchartPartitionByYear.get(year).find(e => e.contentId === id).url;
                    page(url);
                } : undefined,
                legendItems: !isLeaf ? 
                    barchartPartitionByYear.get(year).map(p => ({
                        id: p.contentId,
                        className: p.contentId, 
                        url: p.url, 
                        text: p.texts && p.texts.label,
                        colorClassName: colorClassById.get(p.contentId)
                    })).toArray() : undefined,
                uniqueColorClass: isLeaf ? colorClassById.get(contentId) : undefined,
                yValueDisplay: makeAmountString
            }),
            temporalText ? React.createElement('div', {className: 'temporal', dangerouslySetInnerHTML: {__html: temporalText}}) : undefined
        ),

        !isLeaf ? React.createElement('section', { className: 'partition'}, 
            top ? React.createElement(SecundaryTitle, {text: `Détail des ${top.label} en ${year}`}): undefined,
            thisYearPartition.map(({contentId, partAmount, texts, url}) => {
                return React.createElement('a',
                    {
                        href: url,
                        style:{
                            minHeight: (PARTITION_TOTAL_HEIGHT*partAmount/amount) + MIN_STRING_HEIGHT + 'em'
                        }
                    },
                    React.createElement(
                        'div', 
                        {
                            className: ['part', colorClassById.get(contentId)].join(' '),
                            style:{
                                height: (PARTITION_TOTAL_HEIGHT*partAmount/amount) + 'em'
                            }
                        }, 
                        React.createElement(MoneyAmount, {amount: partAmount})
                    ),
                    React.createElement('div', {className: 'text'},
                        React.createElement('h1', {}, texts && texts.label || contentId),
                        React.createElement('div', {
                            className: 'summary',
                            dangerouslySetInnerHTML: {__html: makeHTMLSummary(texts.atemporal)}
                        }),
                        React.createElement(PrimaryCallToAction)
                    )
                );
            })  
        ) : undefined,

        isLeaf && m52Rows ? React.createElement('section', { className: 'raw-data'}, 
            React.createElement(SecundaryTitle, {text: `Consultez ces données en détail à la norme comptable M52 pour l'année ${year}`}),
            React.createElement('table', {}, 
                React.createElement('thead', {}, 
                    React.createElement('tr', {}, 
                        React.createElement('th', {}, 'Fonction'),
                        React.createElement('th', {}, 'Nature'),
                        React.createElement('th', {}, 'Montant')
                    )
                ),
                React.createElement('tbody', {}, 
                    m52Rows
                    .sort((r1, r2) => r2['Montant'] - r1['Montant'])
                    .map(row => {
                        return React.createElement('tr', {}, 
                            React.createElement('td', {}, rubriqueIdToLabel[row['Rubrique fonctionnelle']]),
                            React.createElement('td', {}, row['Libellé']),
                            React.createElement('td', {}, 
                                React.createElement(MoneyAmount, {amount: row['Montant']})
                            )
                        )
                    })
                )
            ),
            React.createElement(
                DownloadSection, 
                {
                    title: `Données brutes sur datalocale.fr`,
                    items: [
                        {
                            text: 'Comptes administratifs du Département de la Gironde',
                            url: 'https://www.datalocale.fr/dataset/comptes-administratifs-du-departement-de-la-gironde'
                        }
                    ]
                }
            )
        ) : undefined

    );
}



export function makePartition(element, totalById, textsById){
    let children = element.children;
    children = children && typeof children.toList === 'function' ? children.toList() : children;

    return children && children.size >= 1 ? 
        List(children)
        .map(child => ({
            contentId: child.id,
            partAmount: totalById.get(child.id),
            texts: textsById.get(child.id),
            url: `#!/finance-details/${child.id}`
        })) : 
        List().push({
            contentId: element.id,
            partAmount: totalById.get(element.id),
            texts: textsById.get(element.id),
            url: `#!/finance-details/${element.id}`
        });
}



export function makeElementById(hierAgg, hierM52 = {}){
    let elementById = new ImmutableMap();

    flattenTree(hierAgg).forEach(aggHierNode => {
        elementById = elementById.set(aggHierNode.id, aggHierNode);
    });

    flattenTree(hierM52).forEach(m52HierNode => {
        elementById = elementById.set(m52HierNode.id, m52HierNode);
    });

    return elementById;
}

function fillChildToParent(tree, wm){
    visit(tree, e => {
        if(e.children){
            e.children.forEach(c => {
                wm.set(c, e);
            })
        }
    });
}


export default connect(
    state => {        
        const { m52InstructionByYear, textsById, financeDetailId, explorationYear } = state;

        const isM52Element = financeDetailId.startsWith('M52-');

        let RDFI;
        if(isM52Element){
            RDFI = financeDetailId.slice(4, 4+2);
        }

        const m52Instruction = m52InstructionByYear.get(explorationYear);
        const hierM52 = m52Instruction && RDFI && hierarchicalM52(m52Instruction, RDFI);
        const aggregated = m52Instruction && m52ToAggregated(m52Instruction);
        const hierAgg = m52Instruction && hierarchicalAggregated(aggregated);

        const childToParent = new WeakMap();
        if(m52Instruction){
            if(hierM52)
                fillChildToParent(hierM52, childToParent);
            
            fillChildToParent(hierAgg, childToParent);
        }
        
        const displayedContentId = financeDetailId;
        
        const elementById = (m52Instruction && makeElementById(hierAgg, hierM52)) || new ImmutableMap();
        const element = elementById.get(displayedContentId);

        const expenseOrRevenue = element && element.id ? 
            // weak test. TODO : create a stronger test
            (element.id.startsWith('D') || element.id.startsWith('M52-D') ? EXPENDITURES : REVENUE) : 
            undefined;

        const isDeepElement = element && element.id !== EXPENDITURES && element.id !== REVENUE && childToParent.get(element) !== hierM52;

        const parentElement = isDeepElement && childToParent.get(element);
        const topElement = isDeepElement && elementById.get(expenseOrRevenue);
        const topTexts = topElement && textsById.get(topElement.id);
        const topLabel = topTexts && topTexts.label || '';

        const partitionByYear = m52InstructionByYear.map(m52i => {
            const elementById = makeElementById(
                hierarchicalAggregated(m52ToAggregated(m52i)), 
                RDFI ? hierarchicalM52(m52i, RDFI): undefined
            );

            const yearElement = elementById.get(displayedContentId);

            return yearElement && makePartition(yearElement, elementById.map(e => e.total), textsById)
        });

        const amountByYear = m52InstructionByYear.map((m52i) => {
            const elementById = makeElementById(
                hierarchicalAggregated(m52ToAggregated(m52i)), 
                RDFI ? hierarchicalM52(m52i, RDFI): undefined
            );

            const yearElement = elementById.get(displayedContentId);

            return yearElement && yearElement.total;
        });

        const m52Rows = element && (!element.children || element.children.size === 0) ? 
            (isM52Element ?
                 element.elements :
                 element.elements.first()['M52Rows'] 
            ) :
            undefined;

        return {
            contentId: displayedContentId, 
            RDFI,
            amountByYear,
            parent: parentElement && parentElement !== topElement && {
                id: parentElement.id,
                amount: parentElement.total,
                label: textsById.get(parentElement.id).label,
                url: '#!/finance-details/'+parentElement.id
            },
            top: topElement && {
                id: topElement.id,
                amount: topElement.total,
                label: topLabel,
                url: '#!/finance-details/'+topElement.id
            },
            expenseOrRevenue,
            texts: textsById.get(displayedContentId),
            partitionByYear,
            m52Rows,
            year: explorationYear
        }

    },
    dispatch => ({
        changeExplorationYear(year){
            dispatch({
                type: CHANGE_EXPLORATION_YEAR,
                year
            })
        }
    })
)(FinanceElement);
