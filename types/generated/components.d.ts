import type { Schema, Struct } from '@strapi/strapi';

export interface EvaluationDimension extends Struct.ComponentSchema {
  collectionName: 'components_evaluation_dimensions';
  info: {
    description: '';
    displayName: 'Dimension';
  };
  attributes: {
    comment: Schema.Attribute.Text & Schema.Attribute.Required;
    dimensionKey: Schema.Attribute.String & Schema.Attribute.Required;
    quiz: Schema.Attribute.Component<'evaluation.question', true>;
  };
}

export interface EvaluationQuestion extends Struct.ComponentSchema {
  collectionName: 'components_evaluation_questions';
  info: {
    description: '';
    displayName: 'Question';
  };
  attributes: {
    answer: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 5;
          min: 1;
        },
        number
      >;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'evaluation.dimension': EvaluationDimension;
      'evaluation.question': EvaluationQuestion;
    }
  }
}
